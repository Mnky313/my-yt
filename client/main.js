/* global EventSource, MutationObserver */
import Store from '../../../../../lib/store.js'
import { createVideoElement } from '../../../../../lib/utils.js'
const store = new Store()
window.state = {
  downloading: {},
  summarizing: {}
}

const eventSource = new EventSource('/')
eventSource.onmessage = (message) => {
  if (!message || !message.data) return console.error('skipping empty message')
  try {
    const data = JSON.parse(message.data, {})
    console.log('[sse] message', data)

    if (data.type === 'state' && data.state) {
      Object.assign(window.state, data.state)
      const $state = document.querySelector('.state')
      if (!$state) { return console.warn('missing $state') }
      const $count = $state.querySelector('.count')
      const $downloading = $state.querySelector('.downloading')
      const downloadingCount = Object.keys(data.state.downloading || {}).length
      $downloading.innerText = `Downloading: ${downloadingCount}`

      setTimeout(() => {
        Object.keys(data.state.downloading || {}).forEach((videoId) => {
          const $video = document.querySelector(`video-element[data-video-id="${videoId}"]`)
          if ($video) $video.dataset.downloading = 'true'
        })
        Object.keys(data.state.summarizing || {}).forEach((videoId) => {
          const $video = document.querySelector(`video-element[data-video-id="${videoId}"]`)
          if ($video) $video.dataset.summarizing = 'true'
        })
        const count = Object.keys(data.state.summarizing || {}).length + Object.keys(data.state.downloading || {}).length
        $count.innerText = count > 0 ? `(${count})` : ''
      }, 500)
      return
    }
    if (data.type === 'download-log-line' && data.line) {
      const $state = document.querySelector('.state')
      if (!$state) { return console.warn('missing $state') }

      const $downloadLogLines = $state.querySelector(' .lines')
      const text = $downloadLogLines.innerText
      let lines = text.split('\n')
      lines = lines.join('\n') + '\n' + data.line
      $downloadLogLines.innerText = lines
      $downloadLogLines.scrollTop = $downloadLogLines.scrollHeight
      return
    }
    if (data.type === 'new-videos' && data.videos) {
      const $videosContainer = document.querySelector('.main-videos-container')
      if (!$videosContainer) return
      const showOriginalThumbnail = store.get(store.showOriginalThumbnailKey)

      data.videos.forEach(video => {
        const $videoElement = $videosContainer.querySelector('video-element')
        if (!$videoElement) return $videosContainer.appendChild(createVideoElement(video, showOriginalThumbnail))
        $videoElement.parentNode.insertBefore(createVideoElement(video, showOriginalThumbnail), $videoElement)
      })
      return
    }
    if (data.type === 'downloaded' && data.videoId && data.downloaded !== undefined) {
      ;[...document.querySelectorAll(`[data-video-id="${data.videoId}"]`)].forEach($video => {
        if (!$video.dataset.data) return
        const videoData = JSON.parse($video.dataset.data)
        videoData.downloaded = data.downloaded
        if (data.video) Object.assign(videoData, data.video)
        $video.dataset.data = JSON.stringify(videoData)
      })
      return
    }
    if (data.type === 'ignored' && data.videoId && data.ignored !== undefined) {
      ;[...document.querySelectorAll(`[data-video-id="${data.videoId}"]`)].forEach($video => {
        if (!$video.dataset.data) return
        const videoData = JSON.parse($video.dataset.data)
        videoData.ignored = data.ignored
        $video.dataset.data = JSON.stringify(videoData)
      })
      return
    }
    console.warn('unhandled', data)
  } catch (err) {
    console.error('sse parse error', err)
  }
}
