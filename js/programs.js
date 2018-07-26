'use strict';

const get = require('lodash.get');

const shalvah = (args) => {
    const program = require('commander');
    program.version('1.0.0')
        .description('Shalvah on your command-line')
        .parse(['', 'shalvah'].concat(args));
    const shalvah = require('shalvah');
    const inquirer = require('inquirer');
    process.stdout.write(shalvah.bio + '\r\n');
    inquirer.prompt({
        name: 'link',
        type: 'list',
        message: shalvah.prompt,
        choices: shalvah.links.concat({
            'name': `...Or shoot me an email (${shalvah.email})`,
            'value': 'mailto:' + shalvah.email
        })
    }).then(answers => {
        process.stdout.write(`Opening ${answers.link}\r\n`);
        window.open(answers.link);
        process.stdout.emit('line-processed');
    });
};

const help = (args) => {
    process.stdout.write('Available commands: pwd, cd, ls, shalvah, help');
    process.stdout.emit('line-processed');
};

function resetSudo() {
    window.PROMPT_CHAR = '>';
    window.sudo = false;
}

const exit = (args) => {
    if (window.sudo) {
        resetSudo();
        process.stdout.emit('line-processed');
    } else {
        process.stdout.write('Bye...\uD83D\uDC4B  ');
        setTimeout(window.close.bind(window), 700)
    }
};

const ls = (args) => {
    if (args[1] === undefined) {
        process.stdout.write(getContents(window.currentDirectory));
    } else {
        process.stdout.write(getContents(args[1]));
    }
    process.stdout.write('\r\n');
    process.stdout.emit('line-processed');
};

const cd = (args) => {
    if (args[1]) {
        changeDirectory(args[1]);
    }
    process.stdout.emit('line-processed');
};

const pwd = (args) => {
    process.stdout.write('/' + window.currentDirectoryPath + '\r\n');
    process.stdout.emit('line-processed');
};

const rm = (args) => {
    if (window.sudo || window.tempSudo) {
        process.stdout.write('Okay, you win \uD83D\uDE22 \r\n');
    } else {
        process.stdout.write('Nah, not today!\uD83D\uDE0E \r\n');
    }
    process.stdout.emit('line-processed');
};

function changeDirectory(to) {
    if (to === '~') {
        window.currentDirectory = window.paths.root;
        window.currentDirectoryPath = 'root';
        window.hasChangedDirectory = false;
        return;
    }

    if (to === '/') {
        window.currentDirectory = window.paths;
        window.currentDirectoryPath = '';
        window.hasChangedDirectory = true;
        return;
    }

    let currentPath = window.currentDirectoryPath.replace('/', '.');
    let newDirectoryPath;
    if (to.startsWith('/')) {
        newDirectoryPath = to.trim('/').replace('/', '.');
    } else {
        newDirectoryPath = currentPath === '' ? to.trim('/') : `${currentPath}.${to}`;
    }
    const newDirectory = get(window.paths, newDirectoryPath);
    if (!newDirectory) {
        process.stdout.write(`No such file or directory: ${to}`);
        return;
    }

    window.currentDirectory = newDirectory;
    window.currentDirectoryPath = newDirectoryPath.replace('.', '/');
    window.hasChangedDirectory = true;
}

function getContents(path) {
    if (path.toString() === '[object Object]') {
        return Object.keys(path).join(' ');
    } else if (typeof path === 'string') {
        if (path === '/') {
            return window.paths;
        } else if (path.startsWith('/')) {
            path = path.trim('/');
            return getContents(get(window.paths, path.replace('/', '.')));
        } else {
            path = window.currentDirectoryPath + '/' + path;
            return getContents(get(window.paths, path.replace('/', '.')));
        }
    } else {
        return `Cannot access ${path}: no such file or directory`;
    }
}

module.exports = {
    shalvah,
    help,
    ls,
    exit,
    cd,
    pwd,
    rm
};
