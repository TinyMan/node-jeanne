const commands = require('./speech-commands.js');
const pass = require('./speechstream.js')();
const s = require('./stumble-instance.js');
const BreakException = require('./utils.js').BreakException;

function main() {
    s.client.on('user-disconnect', (user) => {
        setImmediate(() => {
            console.log("User " + user.name + " disconnected.");
            const u = s.client.users();
            if (u.length == 1) {
                console.log("No one left on the server, stoping the music...");
                s.invoke('stop');
            }
        })
    })
    s.client.connection.ignoreNormalTalking = true;
    s.client.connection.ignoreLastAudioFrame = true;
    s.io.establish({
        output: true,
        outputFrom: true

    });


    s.io.output.pipe(pass)


    pass.textStream.on('data', function(transcripts) {
        //console.log(transcripts);

        try {
            for (name in commands) {
                let command = commands[name];
                if (!command.func) return
                if (typeof command.detector === "object" && command.detector instanceof RegExp) {
                    transcripts.forEach((tr) => {
                        let matches = command.detector.exec(tr.transcript);
                        if (matches) {
                            command.func(matches, tr);
                            throw new BreakException(name, tr.transcript);
                        }
                    });
                } else if (typeof command.detector === "function") {
                    command.detector(transcripts, command.func)
                } else {
                    console.error('Voice command detector not implemented for ' + name);
                }
            }
        } catch (e) {
            if (!(e instanceof BreakException)) throw e;
            console.log("Found match: " + e.command, e.transcript);
        }


    })
}

module.exports = main
