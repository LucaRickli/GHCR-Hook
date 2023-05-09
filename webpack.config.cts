const path = require("path");
const nodeExternals = require("webpack-node-externals");
const NodemonPlugin = require("nodemon-webpack-plugin"); // is not ejs compatible

const { NODE_ENV = "production" } = process.env;

module.exports = {
  mode: NODE_ENV,
  watch: NODE_ENV === "development",
  // devtool: "inline-source-map",
  target: "node",
  entry: "./src/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      src: path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /src\/.{1,}\.ts$/,
        use: ["ts-loader"],
      },
    ],
  },
  externals: [nodeExternals()],
  plugins: [new NodemonPlugin()],
};
