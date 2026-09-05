# Agent Instructions

## Site Information

This site is running in production at:

https://kaaos.radio

The project is a small static site. The main page is `index.html`, the browser-served stylesheet is `style.css`, the Sass source is `style.scss`, and the client-side behavior is in `constellation.js`, `player.js` and `balloons.js`.

The audio stream used by the player is from:
https://kaaos.radio/stream which is an icecast stream that will play 24/7.

- Add comments to every javascript function
- Excpect the developer is running the `npx sass --watch style.scss:style.css` command so you dont need to ask to build the style.scss after every change.
- Don't try to run web server because the project is running on a remote server, not local code base. There is a web server running allready and the developer will check the results with a web browser.