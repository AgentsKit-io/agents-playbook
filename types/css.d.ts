// Side-effect stylesheet imports (`import "./globals.css"`) export nothing.
// TypeScript 7 checks that they resolve, so declare the pattern with an empty body.
declare module '*.css' {}
