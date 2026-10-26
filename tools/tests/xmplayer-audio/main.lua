local root = assert(os.getenv("XMPLAYER_APP_DIR"))
package.path = root .. "/core/?.lua;" .. root .. "/media/?.lua;" .. package.path
local audio = require("ffmpeg_audio")
local started

function love.load()
    audio.init()
    assert(audio.load(assert(os.getenv("XMPLAYER_TEST_AUDIO"))))
    audio.play()
    started = love.timer.getTime()
end

function love.update()
    audio.update()
    if love.timer.getTime() - started > 2.5 then
        assert(audio.getDuration() >= 5, "FFmpeg did not report the fixture duration")
        assert(audio.getSampleCount() > 0, "FFmpeg produced no PCM samples")
        assert(audio.isPlaying(), "LÖVE audio source did not start playing")
        print("XMPlayer PCM decoding and playback passed")
        audio.stop()
        love.event.quit(0)
    end
end
