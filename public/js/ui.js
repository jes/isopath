/* ui */
$(document).ready(function() {
    // TODO: when we're black, invert the labelling vertically?
    var tile_to_hex = {
                    a1:41, a2:42, a3:43, a4:44,
                b1:34, b2:35, b3:36, b4:37, b5:38,
            c1:27, c2:28, c3:29, c4:30, c5:31, c6:32,
        d1:20, d2:21, d3:22, d4:23, d5:24, d6:25, d7:26,
            e1:14, e2:15, e3:16, e4:17, e5:18, e6:19,
                f1: 8, f2: 9, f3:10, f4:11, f5:12,
                    g1: 2, g2: 3, g3: 4, g4: 5,
    };

    var ws; // an IsopathWS from isopath-ws.js
    var ingame = false;
    var ourturn = false;
    var ourcolour;
    var opponentcolour;
    var move = [];
    var clickmode = '';
    var connected = false;
    var to_join;

    function ready() {
        $('#status').text('Ready.');
    }

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

    function clicked_on_hex(tile) {
        if (ingame && ourturn) {
            var this_tile_has = ws.isopath.piece_at(tile);

            if (clickmode == 'piece') {
                if (this_tile_has == '')
                    move.push(["piece",movefrom,tile]);
                clickmode = '';
            } else if (clickmode == 'brick') {
                if (this_tile_has == '')
                    move.push(["brick",movefrom,tile]);
                clickmode = '';
            } else {
                clickmode = '';
                if (this_tile_has == opponentcolour) {
                    // capture
                    move.push(["capture",tile]);
                } else if (this_tile_has == ourcolour) {
                    // start moving a piece
                    clickmode = 'piece';
                    movefrom = tile;
                } else {
                    // start moving a brick
                    clickmode = 'brick';
                    movefrom = tile;
                }
            }

            redraw();

            if (move.length == 2) {
                ws.playMove(move);
                redraw();
            }
        }
    }

    function redraw() {
        for (var tile in tile_to_hex) {
            var idx = tile_to_hex[tile];
            var piece = ws.isopath.piece_at(tile);
            var height = ws.isopath.board[tile];

            // update state for completed halfmove
            if (move.length == 1) {
                if (move[0][0] == 'capture' && move[0][1] == tile)
                    piece = '';
                if (move[0][0] == 'brick' && move[0][1] == tile)
                    height--;
                if (move[0][0] == 'brick' && move[0][2] == tile)
                    height++;
                if (move[0][0] == 'piece' && move[0][1] == tile)
                    piece = '';
                if (move[0][0] == 'piece' && move[0][2] == tile)
                    piece = ourcolour;
            }

            // update state for partial halfmove
            if (clickmode == 'piece' && movefrom == tile)
                piece = '';
            if (clickmode == 'brick' && movefrom == tile)
                height--;

            $('#hex-' + idx).css('background-image', 'url(/img/height' + height + piece + '.png');
        }

        var moves = '';
        for (var i = 0; i < ws.isopath.moves.length; i++) {
            let move = ws.isopath.moves[i];
            if (i%2 == 0)
                moves += "<b>" + Math.round((i+1)/2) + ".</b>";
            for (var j = 0; j < move.length; j++) {
                var type = move[j][0];
                var from = move[j][1];
                var to = move[j][2];
                if (type == 'brick')
                    moves += "&nbsp;B" + from + to;
                if (type == 'piece')
                    moves += "&nbsp;P" + from + to;
                if (type == 'capture')
                    moves += "&nbsp;C" + from;
            }
            if (i%2 == 0)
            moves += ",";
            moves += " ";
        }
        $('#movehistory').html(moves);
    }

    function init_hexgrid(player) {
        $('#hexgrid').html('');
        // 37 tiles, plus 8 invisible ones to get the spacing right
        for (var i = 0; i < 45; i++) {
            $('<div class="lab_item"><div class="hexagon hexagon2"><div class="hexagon-in1"><div class="hexagon-in2" id="hex-' + (i+1) + '"></div></div></div></div>').appendTo('#hexgrid');
        }

        for (var tile in tile_to_hex) {
            var idx = tile_to_hex[tile];
            let t = tile;
            $('#hex-' + idx).click(function() {
                clicked_on_hex(t);
            });
        }

        redraw();
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
            alert("End game because of " + reason);
            ingame = false;
            ready();
        },
        gameStarted: function(player) {
            ourcolour = player;
            opponentcolour = (player == 'white' ? 'black' : 'white');
            $('#yourcolour').text(player);
            $('#await-opponent').hide();
            $('#game').show();
            init_hexgrid(player);
            ingame = true;
            ready();
        },
        movePlayed: function(player, move) {
            redraw();
            ready();
        },
        usToMove: function() {
            $('#whoseturn').text('your');
            ourturn = true;
            clickmode = '';
            move = [];
            ready();
        },
        opponentToMove: function() {
            $('#whoseturn').text("your opponent's");
            ourturn = false;
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

    $('#await-opponent').hide();
    $('#game').hide();

    // join a game straight away if an id is specified in the fragment
    var match = window.location.hash.match(/#join-(.*)/);
    if (match) {
        join_game(match[1]);
    }

    /*init_hexgrid();
    $('#game').show();
    $('#lobby').hide();*/
});
