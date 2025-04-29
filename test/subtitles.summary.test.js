import { test } from 'node:test'
import assert from 'assert'

test('cleans transcript', () => {
  const transcript = `
1
00:00:01,240 --> 00:00:04,630

Open ai writes to the

2
00:00:04,630 --> 00:00:04,640
Open ai writes to the
 

3
00:00:04,640 --> 00:00:09,110
Open ai writes to the
US administration their position Well it is

4
00:00:09,110 --> 00:00:09,120
US administration their position Well it is
 

5
00:00:09,120 --> 00:00:12,509
US administration their position Well it is
necessary that it be free from copyright from

6
00:00:12,509 --> 00:00:12,519
necessary that it be free from copyright from
  `.trim()
  const expectedCleanTranscript = `
Open ai writes to the
US administration their position Well it is
necessary that it be free from copyright from
  `.trim()

  assert.strictEqual(cleanTranscript(transcript), expectedCleanTranscript)
})
