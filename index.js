const EventEmitter = require('events');
const assert = require('assert');
const Primus = require('primus');
const uglify = require('uglify-js');

class PrimusWebpackPlugin {
  constructor(options) {
    this.options = Object.assign(
      {},
      {
        filename: 'primus-client.js',
        minify: false,
        primusOptions: {},
      },
      options
    );
  }

  apply(compiler) {
    compiler.plugin('emit', (compilation, cb) => {
      const primus = new Primus(new EventEmitter(), this.options.primusOptions);

      if (this.options.primusOptions.plugins) {
        this.options.primusOptions.plugins.forEach(plugin => {
          assert(plugin.name, 'Plugin must have name!');
          assert(plugin.plugin, 'Plugin must have plugin!');

          primus.plugin(plugin.name, plugin.plugin);
        });
      }

      const clientLib = primus.library();
      const filename = this.options.filename.replace(
        '[hash]',
        compilation.hash
      );
      const source = this.options.minify
        ? uglify.minify(clientLib, { fromString: true })
        : { code: clientLib };
      
      /*
       *  Really dirty hack of this plugin to stop the production
       *  Ionic app-scripts build throw an error over there not
       *  being a source map for the generated file. Not really sure
       *  why sourcemaps would be important in a production build so
       *  I'm adding this stubbed nonsense one to satify the build.
       */
      compilation.assets[`${filename}.map`] = {
        source() {
          return `
            {
              "version" : 3,
              "file": "primus-client.js",
              "sourceRoot" : "",
              "sources": ["foo.js", "bar.js"],
              "names": ["src", "maps", "are", "fun"],
              "mappings": "AAgBC,SAAQ,CAAEA"
            }
          `
        },
        size() {
          return 0
        }
      }

      compilation.assets[filename] = {
        source() {
          return source.code;
        },
        size() {
          return source.code.length;
        },
      };

      primus.destroy();
      cb(null);
    });

    // if HtmlWebpackPlugin is being utilized, add our script to file
    compiler.plugin('compilation', compilation => {
      compilation.plugin(
        'html-webpack-plugin-before-html-processing',
        (htmlPluginData, cb) => {
          const filename = this.options.filename.replace(
            '[hash]',
            compilation.hash
          );
          const scriptTag = `<script type="text/javascript" src="/${filename}"></script>`;

          if (
            !htmlPluginData.plugin.options.inject ||
            htmlPluginData.plugin.options.inject === 'head'
          ) {
            htmlPluginData.html = htmlPluginData.html.replace(
              '</head>',
              scriptTag + '</head>'
            );
          } else {
            htmlPluginData.html = htmlPluginData.html.replace(
              '</body>',
              scriptTag + '</body>'
            );
          }

          cb(null, htmlPluginData);
        }
      );
    });
  }
}

module.exports = PrimusWebpackPlugin;
