# Isopath

This is a web-based implementation of Isopath, a zero-sum boardgame invented by pocket83.

If you don't know the game, you can learn more in [his original video](https://www.youtube.com/watch?v=Wz6q03b8R6U&t=15m45s) (rules start at 15:45).

## Playing the game

You can play it right now at https://isopath.jes.xxx/

You'll need to know the rules, the graphics are bad, and some of the UX is a bit clunky.

Important non-technical future work would include creating reading materials that introduce beginners to the game.

## Writing an AI

### Javascript

See `public/js/ai/random-moves.js` for a basic example. You need to:

 * create a new class implementing `move()` that returns the move you want to play whenever it gets called
 * call `IsopathAI.register_ai()`, passing it a short name for your AI, a long name, and a generator
   function that creates an instance of your class

You do have direct access to the `Isopath` object (it's passed as the only argument to your constructor), but
you should avoid manipulating it at all. Treat it as read-only. This is not considered a bug as your code
has complete access to everything in the window anyway.

### Websocket

Another option is to read the `API` file and speak websockets (with the help of `stdio-websocket` if you prefer). This
has the advantage that you can write it in whatever langauge you like, and run it remotely, but the disadvantage that you
need to implement the game rules yourself. I intend to implement an example to show how to do this.

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
