/* ui */
$(document).ready(function() {
    // TODO: when they load the page with a gameid in the fragment, try to join that game straight away


    // TODO: when we're black, invert the labelling vertically
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

    function ready() {
        $('#status').text('Ready.');
    }

    function clicked_on_hex(tile) {
        // TODO: make sure it's our turn to move, otherwise do nothing
        // TODO: handle user input; once they've committed to a move, call ws.playMove
    }

    function init_hexgrid(player) {
        $('#hexgrid').html('');
        // 37 tiles, plus 8 invisible ones to get the spacing right
        for (var i = 0; i < 45; i++) {
            $('<div class="lab_item"><div class="hexagon hexagon2"><div class="hexagon-in1"><div class="hexagon-in2" id="hex-' + (i+1) + '"></div></div></div></div>').appendTo('#hexgrid');
        }

        for (var tile in tile_to_hex) {
            var idx = tile_to_hex[tile];
            $('#hex-' + idx).html("<br>    " + tile);
            $('#hex-' + idx).click(function() {
                clicked_on_hex(tile);
            });
        }
    }

    ws = new IsopathWS({
        ws: "ws://" + window.location.hostname + ":" + window.location.port + "/ws",
        awaitingOpponent: function(gameid) {
            alert("New game, id = " + gameid);
            $('#opponent-link').attr('href', window.location + '#join-' + gameid);
            $('#opponent-link').text(window.location + '#join-' + gameid);
            $('#await-opponent').show();
            ready();
        },
        gameEnded: function(reason) {
            alert("End game because of " + reason);
            ready();
        },
        gameStarted: function(player) {
            alert("Joined game. We're " + player);
            $('#await-opponent').hide();
            $('#game').show();
            init_hexgrid(player);
            ready();
        },
        movePlayed: function(player, move) {
            // TODO: redraw grid
            ready();
        },
        usToMove: function() {
            alert("Us to move");
            ready();
        },
        opponentToMove: function() {
            alert("Opponent to move");
            ready();
        },
        connected: function() {
            ready();
        },
        disconnected: function() {
            $('#status').text("Disconnected.");
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
        $('#lobby').hide();
        $('#status').text("Waiting for websocket server...");
        ws.joinGame($('#gameid').val());
    });

    $('#await-opponent-cancel').click(function() {
        $('#await-opponent').hide();
        $('#lobby').show();
        ws.endGame();
    });

    $('#await-opponent').hide();
    $('#game').hide();

    init_hexgrid();
    $('#game').show();
    $('#lobby').hide();
});
