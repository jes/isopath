/* ui */
$(document).ready(function() {
    var ws; // an IsopathWS from isopath-ws.js
    var view; // an IsopathView from isopath-view.js

    var ingame = false;
    var ourturn = false;
    var connected = false;
    var localgame = false;

    function ready() {
        $('#status').text('Ready.');
    }

    function redraw() {
        view.redraw();

        if (localgame) {
            $('#you-are').hide();
        } else {
            $('#you-are').show();
        }

        if (ingame) {
            $('#are').text('are');
            $('#whoseturn-div').show();
            $('#gameover').hide();
        } else {
            $('#are').text('were');
            $('#whoseturn-div').hide();
            $('#gameover').show();
        }
    }

    function game_over() {
        redraw();
        ingame = false;
    }

    function connect_websocket(connected_cb) {
        ws = new IsopathWS({
            ws: "ws://" + window.location.hostname + ":" + window.location.port + "/ws",
            awaitingOpponent: function(gameid) {
                var url = window.location.origin + window.location.pathname + '#join-' + gameid;
                $('#opponent-link').attr('href', url);
                $('#opponent-link').text(url);
                $('#await-opponent').show();
                ready();
            },
            gameEnded: function(reason) {
                ingame = false;
                redraw();
                $('#status').text("Game ended: " + reason);
            },
            gameStarted: function(player) {
                $('#yourcolour').text(player);
                $('#await-opponent').hide();
                $('#gamestate').show();
                view = new IsopathView({
                    isopath: ws.isopath,
                    redraw: function() {
                        redraw();
                    },
                    can_click: function() {
                        return ingame && ourturn;
                    },
                    clicked: function(p) {
                        $('#illegal-move').text('');
                    },
                    move: function(m) {
                        try {
                            ws.playMove(m);
                        } catch(e) {
                            $('#illegal-move').text(e);
                        };
                        if (ws.isopath.winner())
                            game_over();
                    },
                    move_history: function(html) {
                        $('#movehistory').html(html);
                    },
                    partial_move: function(text) {
                        $('#partial-move').text(text);
                    },
                });
                view.init_hexgrid('#hexgrid');
                ingame = true;
                ready();
            },
            movePlayed: function(player, move) {
                if (ws.isopath.winner())
                    game_over();
                redraw();
                ready();
            },
            usToMove: function() {
                $('#whoseturn').text('your');
                ourturn = true;
                $('#reset-move').show();
                clickmode = '';
                move = [];
                ready();
            },
            opponentToMove: function() {
                $('#whoseturn').text("your opponent's");
                ourturn = false;
                $('#reset-move').hide();
                ready();
            },
            connected: function() {
                connected = true;
                connected_cb(ws);
                ready();
            },
            disconnected: function() {
                $('#status').text("Disconnected.");
                ingame = false;
                connected = false;
            },
            error: function(err) {
                $('#status').text("Error: " + err);
            },
        });
        ws.connect();
        $('#status').text("Connecting to websocket...");

        // ping every 60s just to keep the websocket open
        // TODO: if we ever end up creating and deleting multiple websockets, we need
        // to keep track of & clear these timers
        window.setInterval(function() {
            ws.ping();
        }, 60000);
    }

    $('#new-local-game').click(function() {
        $('#lobby').hide();
        $('#gamestate').show();
        localgame = true;

        var isopath = new Isopath();

        view = new IsopathView({
            isopath: isopath,
            redraw: function() {
                redraw();
            },
            can_click: function() {
                return ingame;
            },
            clicked: function(p) {
                $('#illegal-move').text('');
            },
            move: function(m) {
                try {
                    isopath.playMove(m);
                } catch(e) {
                    $('#illegal-move').text(e);
                };
                $('#whoseturn').text(isopath.curplayer + "'s");
                if (isopath.winner())
                    game_over();
            },
            move_history: function(html) {
                $('#movehistory').html(html);
            },
            partial_move: function(text) {
                $('#partial-move').text(text);
            },
        });
        view.init_hexgrid('#hexgrid');
        ingame = true;
        $('#whoseturn').text("white's");
        redraw();
    });

    $('#new-game').click(function() {
        localgame = false;
        $('#lobby').hide();
        $('#status').show();
        $('#status').text("Waiting for websocket server...");
        connect_websocket(function(ws) {
            ws.newGame('white'); // TODO: we should be able to choose
        });
    });

    $('#await-opponent-cancel').click(function() {
        $('#await-opponent').hide();
        $('#lobby').show();
        ws.endGame();
    });

    $('#reset-move').click(function() {
        if (view)
            view.reset_move();
    });

    $('#end-game').click(function() {
        $('#gamestate').hide();
        $('#lobby').show();
        ingame = false;
        if (connected) {
            connected = false;
            ws.disconnect();
        }
    });

    // draw a dummy game board
    view = new IsopathView({
        isopath: new Isopath(),
        can_click: function() {false},
        clicked: function() {},
        partial_move: function() {},
        move_history: function() {},
    });
    view.init_hexgrid('#hexgrid');

    $('#await-opponent').hide();
    $('#gamestate').hide();
    $('#status').hide();

    // join a websocket game straight away if an id is specified in the fragment
    var match = window.location.hash.match(/#join-(.*)/);
    if (match) {
        $('#status').show();
        $('#status').text("Waiting for websocket server...");
        connect_websocket(function(ws) {
            ws.joinGame(match[1]);
            $('#lobby').hide();
        });
    }
});
