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

        var moves = '';
        for (var i = 0; i < ws.isopath.moves.length; i++) {
            let move = ws.isopath.moves[i];
            if (i%2 == 0)
                moves += "<b>" + Math.round((i+1)/2) + ".</b>";
            moves += stringify_move(move, "&nbsp;");
            if (i%2 == 0)
                moves += ",";
            moves += " ";
        }
        var winner = ws.isopath.winner();
        if (winner)
            moves += " " + winner + "&nbsp;wins.";
        $('#movehistory').html(moves);

        var partialmove = '';
        if (ingame && ourturn) {
            partialmove = stringify_move(move, " ");
            if (clickmode == 'tile') {
                partialmove += ' ' + 'T' + movefrom + '..';
            } else if (clickmode == 'piece') {
                partialmove += ' ' + 'P' + movefrom + '..';
            }
        }
        $('#partial-move').text(partialmove);

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

    function reset_move() {
        move = [];
        clickmode = '';
        redraw();
    }

    function game_over() {
        redraw();
        ingame = false;
    }

    function stringify_move(x, space) {
        var s = '';
        for (var j = 0; j < x.length; j++) {
            var type = x[j][0];
            var from = x[j][1];
            var to = x[j][2];
            if (type == 'tile')
                s += space + "T" + from + to;
            if (type == 'piece')
                s += space + "P" + from + to;
            if (type == 'capture')
                s += space + "C" + from;
        }

        return s;
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
        reset_move();
    });

    $('#await-opponent').hide();
    $('#game').hide();

    // join a game straight away if an id is specified in the fragment
    var match = window.location.hash.match(/#join-(.*)/);
    if (match) {
        join_game(match[1]);
    }
});
