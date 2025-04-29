import fs from 'fs'

export default class Repository {
  constructor (basePath = './data') {
    this.channels = []
    this.videos = []
    this.basePath = basePath
    this.paths = {
      videos: `${this.basePath}/videos.json`,
      channels: `${this.basePath}/channels.json`,
      settings: `${this.basePath}/settings.json`
    }

    fs.mkdirSync(`${this.basePath}/videos`, { recursive: true })
    if (!fs.existsSync(this.paths.videos)) {
      fs.writeFileSync(this.paths.videos, '[]')
    }
    if (!fs.existsSync(this.paths.channels)) {
      fs.writeFileSync(this.paths.channels, '[]')
    }
    if (!fs.existsSync(this.paths.settings)) {
      fs.writeFileSync(this.paths.settings, JSON.stringify({
        videoQuality: 720,
        transcodeVideos: true,
        excludedTerms: []
      }, null, 2))
    }

    try {
      this.videos = JSON.parse(fs.readFileSync(this.paths.videos))
      this.channels = JSON.parse(fs.readFileSync(this.paths.channels))
      this.settings = JSON.parse(fs.readFileSync(this.paths.settings))
    } catch (err) {
      console.error(err)
    }
    if (this.settings.transcodeVideos === undefined) { this.setTranscodeVideosSetting(true) }
    if (this.settings.excludedTerms === undefined) {
      this.settings.excludedTerms = []
      this.saveSettings()
    }

    fs.readdirSync(`${this.basePath}/videos`).forEach(file => {
      const format = file.substring(file.lastIndexOf('.') + 1)
      if (!['mp4', 'webm'].includes(format)) return
      const videoId = file.replace(/\.(webm|mp4)$/, '')
      const location = `${this.basePath}/videos/${file}`
      this.updateVideo(videoId, { downloaded: true, location, format })
    })
    this.saveVideos()
  }

  getChannels () { return this.channels }
  channelExists (name) {
    return !!this.channels.find(c => c.name === name)
  }

  addChannel (name) {
    this.channels.push({ name })
    this.saveChannels()
  }

  deleteChannel (name) {
    this.channels.splice(this.channels.findIndex(c => c.name === name), 1)
    this.saveChannels()
  }

  saveChannels () {
    fs.writeFileSync(this.paths.channels, JSON.stringify(this.channels, null, 2))
  }

  saveSettings () {
    fs.writeFileSync(this.paths.settings, JSON.stringify(this.settings, null, 2))
  }

  getAllVideos () {
    return this.videos
  }

  filterByExcludedTerms (v, excludedTerms = this.getExcludedTerms()) {
    return v.downloaded || !excludedTerms.some(term => v.title?.toLowerCase().includes(term) || v.description?.toLowerCase().includes(term))
  }

  getVideos (query = {}) {
    const filterKeys = Object.keys(query).filter(k => k !== 'filter')
    // console.log(filterKeys)
    let videos = this.videos
      .filter(v => query.excluded === 'true' ? !this.filterByExcludedTerms(v) : this.filterByExcludedTerms(v))
    if (query.downloaded === 'true') videos = videos.filter(v => v.downloaded)
    // console.log('downloaded', videos.length)
    if (query.ignored === 'true') videos = videos.filter(v => v.ignored)
    // console.log('ignored', videos.length)
    if (filterKeys.length === 0) videos = videos.filter(v => !v.ignored)
    // console.log('filterKeys.length', filterKeys.length === 0, videos.length)

    videos.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))

    if (query.filter) {
      // console.log('has filter', query.filter)
      const searchTerm = query.filter.toLowerCase()
      if (searchTerm.startsWith('@')) {
        videos = videos.filter(v => {
          return v.channelName.toLowerCase().includes(searchTerm.substring(1))
        })
      } else {
        videos = videos.filter(v => {
          return v.channelName.toLowerCase().includes(searchTerm) ||
          v.title?.toLowerCase().includes(searchTerm) ||
          v.description?.toLowerCase().includes(searchTerm)
        })
      }
    }
    videos = videos.filter((_, i) => i < 100)

    return videos
  }

  getVideo (id) {
    return this.videos.find(v => v.id === id)
  }

  getChannelVideos (name) {
    return this.videos.filter(v => v.channelName === name)
  }

  upsertVideos (videos) {
    (Array.isArray(videos) ? videos : [videos])
      .forEach(v => {
        const index = this.videos.findIndex(video => video.id === v.id)
        if (index !== -1) {
          this.videos[index] = Object.assign(this.videos[index], v)
        } else {
          this.videos.push(v)
        }
      })
    this.saveVideos()
  }

  updateVideo (id, update) {
    const index = this.videos.findIndex(v => v.id === id)
    if (index !== -1) {
      Object.assign(this.videos[index], update)
      this.saveVideos()
      return this.videos[index]
    }
  }

  deleteVideo (id) {
    this.videos = this.videos.map(v => {
      if (v.id === id) {
        return Object.assign(v, { downloaded: false })
      }
      return v
    })
    this.saveVideos()

    const files = fs.readdirSync(`${this.basePath}/videos`)
    files.forEach(file => {
      if (file.startsWith(id)) {
        fs.unlink(`${this.basePath}/videos/${file}`, err => {
          if (err) return console.error('failed to delete file', file)
          console.log('deleted video file', file)
        })
      }
    })
  }

  saveVideos () {
    fs.writeFileSync(this.paths.videos, JSON.stringify(this.videos, null, 2))
  }

  toggleIgnoreVideo (id) {
    const index = this.videos.findIndex(v => v.id === id)
    let ignored = false
    if (index !== -1) {
      ignored = this.videos[index].ignored = !this.videos[index].ignored
    } else {
      console.log('cannot set video ignored, video does not exist', id)
    }
    this.saveVideos()
    return ignored
  }

  setVideoTranscript (id, transcript = '') {
    return this.updateVideo(id, { transcript })
  }

  setVideoDownloaded (id, downloaded = true) {
    return this.updateVideo(id, { downloaded })
  }

  patchVideo (video) {
    if (this.getVideo(video.id)) return video
    return Object.assign(video, { addedAt: Date.now() })
  }

  getVideoQualitySetting () {
    return this.settings.videoQuality
  }

  setVideoQualitySetting (videoQuality) {
    if ([360, 480, 720, 1080, 1440, 2160].includes(videoQuality)) {
      this.settings.videoQuality = videoQuality
      this.saveSettings()
    } else {
      console.log('Invalid video quality', videoQuality)
    }
    return this.settings.videoQuality
  }

  getTranscodeVideosSetting () {
    return this.settings.transcodeVideos
  }

  setTranscodeVideosSetting (value) {
    this.settings.transcodeVideos = !!value
    this.saveSettings()
    return this.settings.transcodeVideos
  }

  getExcludedTerms () {
    return this.settings.excludedTerms || []
  }

  addExcludedTerm (term = '') {
    if (!term) return
    term = term.trim()
    const excludedTerms = this.getExcludedTerms()
    if (!excludedTerms.includes(term) && term) {
      excludedTerms.push(term)
      this.settings.excludedTerms = excludedTerms
      this.saveSettings()
    }
  }

  removeExcludedTerm (term) {
    const excludedTerms = this.getExcludedTerms()
    const index = excludedTerms.indexOf(term)
    if (index >= 0) {
      excludedTerms.splice(index, 1)
      this.settings.excludedTerms = excludedTerms
      this.saveSettings()
    }
  }
}
