/* ui */
$(document).ready(function() {
    var ws; // an IsopathWS from isopath-ws.js
    var ingame = false;
    var ourturn = false;
    var connected = false;
    var view;

    function ready() {
        $('#status').text('Ready.');
    }

    var to_join;
    function join_game(gameid) {
        if (connected) {
            join_game_now(gameid);
        } else {
            to_join = gameid;
        }
    }

    function join_game_now(gameid) {
        $('#lobby').hide();
        $('#status').text("Waiting for websocket server...");
        ws.joinGame(gameid);
    }

    function redraw() {
        view.redraw();

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

    ws = new IsopathWS({
        ws: "ws://" + window.location.hostname + ":" + window.location.port + "/ws",
        awaitingOpponent: function(gameid) {
            $('#opponent-link').attr('href', window.location + '#join-' + gameid);
            $('#opponent-link').text(window.location + '#join-' + gameid);
            $('#await-opponent').show();
            ready();
        },
        gameEnded: function(reason) {
            ingame = false;
            redraw();
            ready();
        },
        gameStarted: function(player) {
            $('#yourcolour').text(player);
            $('#await-opponent').hide();
            $('#game').show();
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
            if (to_join) {
                join_game_now(to_join);
            }
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
    window.setInterval(function() {
        ws.ping();
    }, 60000);

    $('#new-game').click(function() {
        $('#lobby').hide();
        $('#status').text("Waiting for websocket server...");
        ws.newGame('white'); // TODO: we should be able to choose
    });

    $('#join-game').click(function() {
        join_game($('#gameid').val());
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

    $('#await-opponent').hide();
    $('#game').hide();

    // join a game straight away if an id is specified in the fragment
    var match = window.location.hash.match(/#join-(.*)/);
    if (match) {
        join_game(match[1]);
    }
});
