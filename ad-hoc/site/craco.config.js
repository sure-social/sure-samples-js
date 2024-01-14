
module.exports = {
    presets: [
        'react-app',
    ],
    webpack: {
        configure: ( webpackConfig, { env, paths }) => {

            webpackConfig.module.rules.push ({
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: true
                    }
                }
            });

            return webpackConfig;
        },
    },
};
