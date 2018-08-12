/* ui */
$(document).ready(function() {
    var isopath; // an Isopath from isopath.js
    var ws; // an IsopathWS from isopath-ws.js
    var view; // an IsopathView from isopath-view.js

    var ingame = false;
    var ourturn = false;
    var connected = false;
    var localgame = false;

    function ready() {
        $('#status').text(_('Ready.'));
    }

    function redraw() {
        view.redraw();

        if (localgame) {
            $('#you-are').hide();
        } else {
            $('#you-are').show();
        }

        if (ingame) {
            if (isopath.moves.length === 0) {
                $('#undo-move').attr('disabled', true);
            }
            if (localgame)
                $('#whoseturn').text(isopath.curplayer + "'s");
            $('#are').text('are');
            $('#whoseturn-div').show();
            $('#gameover').hide();
        } else {
            $('#are').text('were');
            $('#whoseturn-div').hide();
            $('#gameover').show();
            $('#reset-move').hide();
        }
    }

    // https://stackoverflow.com/a/1026087
    function ucfirst(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function game_over(winner) {
        ingame = false;
        redraw();
        $('#whowon').html("<b>" + ucfirst(winner) + "</b> won.");
    }

    function connect_websocket(connected_cb) {
        ws = new IsopathWS({
            ws: (window.location.protocol == 'http:' ? "ws://" : "wss://") + window.location.hostname + ":" + window.location.port + "/ws",
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

                if (player == 'white') {
                    $('#white-name').text(_('Local player'));
                    $('#black-name').text(_('Remote player'));
                } else {
                    $('#black-name').text(_('Local player'));
                    $('#white-name').text(_('Remote player'));
                }

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
                            game_over(ws.isopath.winner());
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
                redraw();
                ready();
            },
            movePlayed: function(player, move) {
                if (ws.isopath.winner())
                    game_over(ws.isopath.winner());
                redraw();
                ready();
            },
            usToMove: function() {
                $('#whoseturn').text(_('your'));
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
                $('#status').text(_("Disconnected."));
                ingame = false;
                connected = false;
            },
            error: function(err) {
                if (ingame) {
                    $('#status').text(_("Error") + ": " + err);
                } else {
                    $('#awaiting-opponent').hide();
                    $('#gamestate').hide();
                    $('#lobby').show();
                }
                ingame = false;
            },
        });
        isopath = ws.isopath;
        ws.connect();
        $('#status').text(_("Connecting to websocket..."));

        // ping every 60s just to keep the websocket open
        // TODO: if we ever end up creating and deleting multiple websockets, we need
        // to keep track of & clear these timers
        window.setInterval(function() {
            ws.ping();
        }, 60000);
    }

    $('#new-local-game').click(function() {
        $('#lobby').hide();
        $('#status').hide();
        $('#gamestate').show();
        $('#undo-move').show();
        localgame = true;

        isopath = new Isopath();
        var ai = {};
        var time = {white: 0, black: 0};
        var movestarted;

        // assign ai players, if any
        var players = {white:1, black:1};
        for (player in players) {
            var type = $('#' + player + '-player').val();
            if (type != 'human')
                ai[player] = new IsopathAI(type, isopath);
            $('#' + player + '-name').text($('#' + player + '-player option:selected').text());
        }

        $('#undo-move').off('click');
        $('#undo-move').click(function() {
            isopath.undoMove();
            if ((ai['black'] || ai['white']) && (!isopath.winner() || !ai[isopath.winner()])) // undo 2 moves when playing against ai, except where the human won, because we need to undo the ai move as well as the human move
                isopath.undoMove();
            ingame = true;
            view.reset_move();
            redraw();
        });

        function nextMove() {
            if (!ingame)
                return;

            if (movestarted) {
                time[isopath.other[isopath.curplayer]] += (Date.now() - movestarted);
            }
            console.log("White: " + (time.white / 1000) + "s; Black: " + (time.black / 1000) + "s");
            movestarted = Date.now();

            if (isopath.winner())
                game_over(isopath.winner());
            else if (ai[isopath.curplayer]) {
                $('#reset-move').hide();
                $('#undo-move').attr('disabled',true);
                redraw();
                // run ai move after a timeout so that the UI updates before the AI is thinking
                window.setTimeout(function() {
                    try {
                        isopath.playMove(ai[isopath.curplayer].move());
                    } catch(e) {
                        $('#illegal-move').text("Illegal move from " + isopath.curplayer + " AI: " + e);
                        ingame = false;
                    };
                    redraw();
                    nextMove(); // this is not infinite recursion even in an ai-vs-ai game, because of the setTimeout
                }, 100);
            } else {
                $('#reset-move').show();
                $('#undo-move').attr('disabled',false);
            }
        }

        view = new IsopathView({
            isopath: isopath,
            redraw: function() {
                redraw();
            },
            can_click: function() {
                return ingame && !ai[isopath.curplayer];
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
                nextMove();
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
        redraw();
        nextMove();
    });

    $('#new-game').click(function() {
        localgame = false;
        $('#lobby').hide();
        $('#status').show();
        $('#status').text(_("Waiting for websocket server..."));
        if ($('#play-as').val() == 'white') {
            $('#white-name').text(_('Local player'));
            $('#black-name').text(_('Remote player'));
        } else {
            $('#black-name').text(_('Local player'));
            $('#white-name').text(_('Remote player'));
        }
        $('#undo-move').hide();
        connect_websocket(function(ws) {
            ws.newGame($('#play-as').val());
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
        // TODO: actually stop the AI, etc.
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

    // add the list of available ais
    var ais = IsopathAI.list_ais();
    for (ai in ais) {
        $('#white-player').append($('<option>', {
            value: ai,
            text: _("Computer") + ": " + ais[ai].name,
        }));
        $('#black-player').append($('<option>', {
            value: ai,
            text: _("Computer") + ": " + ais[ai].name,
        }));
    }

    // join a websocket game straight away if an id is specified in the fragment
    var match = window.location.hash.match(/#join-(.*)/);
    if (match) {
        $('#status').show();
        $('#undo-move').hide();
        $('#status').text(_("Waiting for websocket server..."));
        connect_websocket(function(ws) {
            ws.joinGame(match[1]);
            $('#lobby').hide();
        });
    }

    if (window.location.hash == '#rules') {
        $('#rulesModal').modal('show');
    }
    $('#rulesModal').on('show.bs.modal', function() {
        window.location.hash = '#rules';
    });
    $('#rulesModal').on('hide.bs.modal', function() {
        window.location.hash = '';
    });

    if (window.location.hash == '#about') {
        $('#about').modal('show');
    }
    $('#aboutModal').on('show.bs.modal', function() {
        window.location.hash = '#about';
    });
    $('#aboutModal').on('hide.bs.modal', function() {
        window.location.hash = '';
    });
});
