const path = require('path');
const ytdl = require('ytdl-core');
const YouTube = require('youtube-node');
const chooseFormat = require("ytdl-core/lib/util").chooseFormat;
const fixedQueue = require('fixedqueue').FixedQueue;
const keys = require(path.join(__dirname, "../keys/api-keys.json"));

function ytapi(options) {
    options = Object.assign({}, {
        type: "video"
    }, options);
    let ytapi = new YouTube();
    ytapi.setKey(keys["youtube"]);
    for (var k in options)
        ytapi.addParam(k, options[k]);
    return ytapi;
}

function youtube_parser(url) {
    var ID = '';
    url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
    if (url[2] !== undefined) {
        ID = url[2].split(/[^0-9a-z_\-]/i);
        ID = ID[0];
    } else {
        ID = url;
    }
    return ID;
}


const youtube = {
    handle: 'yt',
    exec: function(data) {
        this.invoke('stop')
        youtube.stopped = false;
        const stumble = this;

        const links = stumble.execute('parser::getlinks', {
            html: data.message
        });

        if (!links.length) {
            if (data.user) data.user.sendMessage('No link provided. Trying the first video that match those terms: ' + data.message);
            ytapi().search(data.message, 1, function(err, res) {
                if (err) {
                    console.error(err);
                    return data.user ? data.user.sendMessage('Error while searching video on youtube') : false;
                }
                if (res.items.length > 0)
                    streamYt("https://youtu.be/" + res.items[0].id.videoId, res.items[0]);
                else {
                    stumble.client.user.channel.sendMessage('No video found: <b>' + data.message + '</b>')
                }
            });
        } else {
            streamYt(links[0])
        }

        function streamYt(link, item) {
            if (stumble.io.input) {
                youtube.playlist.push(item.id.videoId);
                console.log(youtube.playlist);
                return;
            }
            //    console.log(youtube.ytHistory);
            try {
                stumble.execute("info::playing", {
                    item: item
                });
                /*let message = "Now playing <b>" + item.snippet.title + "</b> (<a href=\"" + link + "\">" + link + "</a>)";

                stumble.client.user.channel.sendMessage(message);*/
            } catch (e) {
                console.error(e)
            }
            console.log(link)
            ytdl.getInfo(link, function(err, info) {
                if (err) throw err;
                youtube.ytHistory.push(youtube_parser(link));
                let fmt = chooseFormat(info.formats, {
                    quality: 'highest',
                    filter: "audioonly"
                });
                let st = ytdl.downloadFromInfo(info, {
                    format: fmt
                });
                st.on('error', function(e) {
                    console.error("Download error:", e)
                    st.end()
                })
                st.on('abort', function() {
                    console.error('Download abort')
                })
                st.on("request", function(req) {
                    // console.log("Download request: ", req)
                })
                // st.on('info', function (info, format) {
                //     console.log("Stream info:", info, format)
                // })

                //console.log(fmt)
                stumble.execute("audio::playstream", {
                    stream: st,
                    format: {
                        bitrate: fmt.audioBitrate,
                        format: fmt.audioEncoding
                    },
                    done: perr => {
                        st.end();
                        if (perr && perr.code !== 'APKILL')
                            if (data.user) data.user.sendMessage('Audio output got tied up.')

                        if (youtube.stopped) return;
                        if (youtube.playlist.length > 0) {
                            stumble.invoke('yt', {
                                message: youtube.playlist.shift()
                            });
                        } else {
                            let id = youtube_parser(link);
                            console.log("Searching related for " + id + "(" + link + ")\n");
                            ytapi().related(id, 6, function(err, res) {
                                if (err) return console.error(err);
                                let find = function(e) {
                                    let i = 0;
                                    let found = false;
                                    while (!found && i < youtube.ytHistory.length) {
                                        found = e.id.videoId == youtube.ytHistory[i++];
                                    }
                                    return found;
                                };
                                let item = ((items) => {
                                    let i = 0;
                                    let found = false;
                                    while (!found && i < items.length) {
                                        found = !find(items[i++]);
                                    }
                                    if (found) return items[--i];
                                    return null;
                                })(res.items);

                                if (item)
                                    streamYt("https://youtu.be/" + item.id.videoId, item);
                            })
                        }
                    }
                });
            })

        }
    }
}
const playlist = {
    handle: "playlist",
    exec: function(data) {
        this.invoke('stop')
        youtube.stopped = false;
        const stumble = this;

        const links = stumble.execute('parser::getlinks', {
            html: data.message
        });

        if (!links.length) {
            if (data.user) data.user.sendMessage('No link provided. Trying the first playlist that match those terms: ' + data.message);
            ytapi().search(data.message, 1, function(err, res) {
                if (err) {
                    console.error(err);
                    return data.user ? data.user.sendMessage('Error while searching playlist on youtube') : false;
                }
                /*if (res.items.length > 0)
                    streamYt("https://youtu.be/" + res.items[0].id.videoId, res.items[0]);
                else {
                    stumble.client.user.channel.sendMessage('No video found: <b>' + data.message + '</b>')
                }*/
            });
        } else {
            //streamYt(links[0])
        }
    }
}
const addnext = {
    handle: "addnext",
    exec: function(data) {
        youtube.playlist.splice(0, youtube.playlist.length);
        youtube.playlist.push(data.message);
        this.execute("info::next", {
            terms: data.message
        });
    }
}
const add = {
    handle: "add",
    exec: function(data) {
        youtube.playlist.push(data.message);
        this.execute("info::added", {
            terms: data.message
        });
    }
}
const ytstop = {
    handle: "stop",
    exec: function(data) {
        data = data || {};
        if (data.empty) youtube.playlist.splice(0, youtube.playlist.length);
        youtube.stopped = true;
        this.execute('audio::stopfile', {
            force: true
        });
        this.io.nullify({
            input: true
        });
    }
}
const ytnext = {
    handle: "ytnext",
    exec: function(data) {
        this.execute('audio::stopfile', {
            force: true
        });
    }
}

youtube.playlist = [];
youtube.ytHistory = fixedQueue(15);

module.exports = {
    youtube,
    ytstop,
    ytnext,
    add,
    addnext
}
