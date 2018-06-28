# Isopath

This is a web-based implementation of Isopath, a zero-sum boardgame invented by pocket83.

If you don't know the game, you can learn more in [his original video](https://www.youtube.com/watch?v=Wz6q03b8R6U&t=15m45s) (rules start at 15:45).

## Playing the game

You can play it right now at https://isopath.jes.xxx/

You'll need to know the rules, the graphics are bad, and some of the UX is a bit clunky.

Important non-technical future work would include creating reading materials that introduce beginners to the game.

## Writing an AI

The motivation for this project in the first place was that I wanted to write an Isopath AI, and therefore needed a user
interface. It's unfortunate that I haven't got as far as actually implementing an AI yet.

But if *you* want to write an Isopath AI...

The easiest way to start writing an AI is probably to write it in javascript and hack it in to the "local game" mode.
I intend to implement an example to show how to do this.

Another option is to read the `API` file and speak websockets (with the help of `stdio-websocket` if you prefer). This
has the advantage that you can write it in whatever langauge you like, and run it remotely, but the disadvantage that you
need to implement the game rules yourself. I also intend to implement an example to show how to do this.

## Self-hosting

If you only want to play locally, you should be able to load `public/index.html` in your favourite web browser.

If you want websocket support, you'll need to get some Perl on. The easiest way to do this on Ubuntu is:

    $ sudo apt install cpanminus
    $ sudo cpanm Mojolicious
    $ morbo isopath

And then you can visit http://localhost:3000/ and play it. `Mojolicious` is an excellent web framework for Perl (used here for
its websocket support). `morbo` is a program that runs a `Mojolicious` application single-threaded and restarts it whenever
the code changes.

If you want to run it in a "production" environment, you'll want to use `hypnotoad` instead of `morbo`, and you'll probably
want a config file. Create a file called `isopath.conf` in the root directory of the repo, with contents like:

    {hypnotoad => {listen => ['http://*:9008'], workers => 1}}

That will instruct hypnotoad to listen on port 9008 and run 1 thread. Don't start more than 1 thread else the websockets
for the two players of a game will sometimes be in different threads and therefore unable to communicate with one another.
Running in hypnotoad also causes Mojolicious to run in "production" mode instead of "development" mode which (among other
things) prevents it from leaking so much internal state in error pages.

Start it (and restart it, whenever you want) with:

    $ hypnotoad isopath

## Contact me

Please email james@incoherency.co.uk to discuss anything remotely Isopath-related!
