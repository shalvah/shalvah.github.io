const browserify = require('browserify');

const options = {
    insertGlobals: true
};
if (process.argv.includes('--debug')) {
    options.debug = true;
}
browserify('js/index.js', options)
    .transform('aliasify', {
        aliases: {
            readline: './js/shims/readline.js',
            'supports-color': './js/shims/supports-color.js',
            // problematic module that I'm not using in my site
            'iconv-lite': './node_modules/browserify/lib/_empty.js'
        },
        verbose: true,
        global: true
    })
    .bundle()
    .pipe(process.stdout);
