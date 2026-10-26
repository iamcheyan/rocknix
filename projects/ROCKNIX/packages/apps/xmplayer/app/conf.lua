function love.conf(t)
    t.identity = "xmplayer"
    t.version = "11.5"
    t.window.title = "XMPlayer"
    local simulator = os.getenv("XMPLAYER_SIMULATOR") == "1"
    t.window.width = simulator and 720 or 0
    t.window.height = simulator and 480 or 0
    t.console = true
end
