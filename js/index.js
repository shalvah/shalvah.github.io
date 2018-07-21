const term = createTerminal();
setUpTermEventHandlers(term);
setUpShims(term);
setUpTermUi(term);

console.log(process);
window.term = term;

function setUpTermEventHandlers(term) {
    term.on('key', (key, ev) => {
        const printable = (
            !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
        );

        if (ev.key === 'Enter') {
            term.newLine();
        } else if (ev.key === 'Backspace') {
            // Do not delete the prompt
            if (term.buffer.x > PROMPT.length) {
                term.write('\b \b');
            }
            const value = term.textarea.value
            term.textarea.value = value.slice(0, value.length - 1);
            console.log(term.textarea.value);
        } else if (printable) {
            if(term.textarea.value.split(/\s+/).length < 2 && key !== ' ') {
                term.write(require('chalk').cyan(key));
            } else {
                term.write(key);
            }
        }
    });

    term.on('paste', function (data, ev) {
        term.write(data);
    });

    term.on('newline', (line) => {
        let argv = line.text.split(/\s+/);
        if (!argv[0]) {
            term.emit('line-processed');
            return;
        }

        term.write('\r\n');
        if (argv[0].toLowerCase() !== 'shalvah') {
            term.write('Unknown command: ' + argv[0]);
            term.emit('line-processed');
            return;
        }

        const program = require('commander');
        program.version('1.0.0')
            .description('Shalvah on your command-line')
            .parse([''].concat(argv));
        const shalvah = require('shalvah');
        const inquirer = require('inquirer');
        inquirer.prompt({
            name: 'link',
            type: 'list',
            message: shalvah.prompt,
            choices: shalvah.links.concat({
                'name': `...Or shoot me an email (${shalvah.email})`,
                'value': 'mailto:' + shalvah.email
            })
        }).then(answers => {
            console.log(`Opening ${answers.link}`);
            window.open(answers.link);
        });

    });

    term.on('line-processed', () => {
        term.writeWithPrompt('');
    });
}

function setUpShims(term) {
    /*
     * The most important shim. Used by both Commander and Inquirer.
     * We're tricking them into thinking xterm is a TTY
     */
    term.isTTY = true;
    process.stdout = process.stdin = process.stderr = term;

    /*
     * Shim process.exit so calling it actually halts execution. Used in Commander
     */
    process.exit = () => {
        term.emit('line-processed');
        throw 'process.exit';
    };
    window.onerror = (n, o, p, e, error) => {
        if (error === 'process.exit') {
            console.log(error);
            return true;
        }
    };

    process.binding = (name) => {
        return (name === 'constants') ? require('constants') : {};
    };
    process.versions = {
        node: '8.10.0',
        v8: '6.2.414.50'
    };

    /*
     * Used by Commander for error responses
     * This is covers only my specific use cases
     * and tries to maintain regular console logs for other packages
     */
    let originalConsoleError = console.error.bind(console);
    console.error = (...args) => {
        if (!args.length) {
            term.writeln('');
        } else if (args[0].includes('error: unknown option')) {
            term.writeln(require('util').format(...args));
        } else {
            originalConsoleError(...args);
        }
    };
}

function createTerminal() {
    const Terminal = require('xterm').Terminal;
    const fullscreen = require('xterm/lib/addons/fullscreen/fullscreen');
    Terminal.applyAddon(fullscreen);

    const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
    });

    const PROMPT = '> ';
    term.writeWithPrompt = function (...args) {
        this.writeln(...args);
        this.write(PROMPT);
    };
    term.newLine = function () {
        let value = this.textarea.value;
        this.textarea.value = "";
        this.emit('newline', { text: value });
    };
    return term;
}

function setUpTermUi(term) {
    term.open(document.getElementById('terminal'));
    term.toggleFullScreen();
    term.write('Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ');
    term.writeWithPrompt('');
    term.focus();
}
