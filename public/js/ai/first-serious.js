/* first serious attempt at an Isopath AI:
 *  - based on a negamax search, but cutting down the search space
 *    by not searching every possibility of tile placement
 *  - algorithm is mostly as intended, but efficiency is poor
 */

function FirstSerious(isopath) {
    this.isopath = isopath;
}

FirstSerious.piece_score = function(place, colour) {
    if (colour == 'black') {
        // just invert the location and then score as if it's white
        place.replace('a', 'G'); place.replace('b', 'F'); place.replace('c', 'E');
        place.replace('g', 'a'); place.replace('f', 'b'); place.replace('e', 'c');
        place = place.toLowerCase();
    }

    var row = place.charCodeAt(0) - 'a'.charCodeAt(0);
    return row;
};

FirstSerious.maxscore = 100000;
FirstSerious.prototype.evaluate = function(isopath) {
    // one score for tile values for each player
    var whitetiles = 0;

    // small extra bonus for controlling the centre
    whitetiles += isopath.board["d1"]-1; // teleport
    whitetiles += isopath.board["d4"]-1; // centre of board
    whitetiles += isopath.board["d7"]-1; // teleport

    // big bonus for building on home row
    for (var col = 1; col <= 4; col++) {
        if (isopath.board["a" + col] != 2)
            whitetiles -= 5;
        if (isopath.board["g" + col] != 0)
            whitetiles += 5;
    }

    // big bonus for approaching home row
    for (var col = 1; col <= 5; col++) {
        whitetiles -= 5 * (2-isopath.board["b" + col]);
        whitetiles += 5 * isopath.board["f" + col];
    }

    // medium bonus for 1 away from approaching home row
    for (var col = 1; col <= 6; col++) {
        whitetiles -= 2 * (2-isopath.board["c" + col]);
        whitetiles += 2 * isopath.board["e" + col];
    }

    var tilescore = isopath.curplayer == 'white' ? whitetiles : -whitetiles;

    // one score for piece values for each player
    var whitepieces = 0;
    for (var i = 0; i < isopath.board['white'].length; i++) {
        var place = isopath.board['white'][i];
        whitepieces += FirstSerious.piece_score(place, 'white');
    }
    for (var i = 0; i < isopath.board['black'].length; i++) {
        var place = isopath.board['black'][i];
        whitepieces -= FirstSerious.piece_score(place, 'black');
    }

    var piecescore = isopath.curplayer == 'white' ? whitepieces : -whitepieces;

    // combine those 2 scores into an evaluation
    return tilescore + 100*piecescore;
};

FirstSerious.prototype.random_location_at_height = function(isopath, h) {
    var p = isopath.all_places;
    var possible = [];
    for (var i = 0; i < p.length; i++) {
        if (isopath.board[p[i]] == h && isopath.piece_at(p[i]) == '')
            possible.push(p[i]);
    }

    return possible[Math.floor(Math.random() * possible.length)];
};

FirstSerious.prototype.dfs = function(isopath, depth_remaining, alpha, beta) {
    // if this is the limit of the search depth, just return the score
    if (depth_remaining == 0) {
        return {
            move: [],
            score: this.evaluate(isopath),
        };
    }

    // if they've just won, we've lost
    if (isopath.winner()) {
        // TODO: once the "if we can win the game instantly, do so" logic is finished, this won't be needed
        return {
            move: [],
            score: -FirstSerious.maxscore,
        };
    }

    var me = isopath.curplayer;
    var you = isopath.other[me];

    // if we can win the game instantly (either capture their final piece, or move to their home row), do so
    if (isopath.board[you].length == 1) {
        var adjacent_men = 0;
        var adjs = isopath.adjacent[isopath.board[you][0]];
        for (var i = 0; i < adjs.length; i++) {
            if (isopath.piece_at(adjs[i]) == me)
                adjacent_men++;
        }

        if (adjacent_men >= 2) {
            return {
                move: ["capture",isopath.board[you][0]],
                score: FirstSerious.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
            };
        }
    }

    // generate candidate moves:

    // TODO: captures

    var piece_moves = [];
    // try moving each of our pieces into each adjacent location
    for (var i = 0; i < isopath.board[me].length; i++) {
        var place = isopath.board[me][i];
        for (var j = 0; j < isopath.adjacent[place].length; j++) {
            var adjplace = isopath.adjacent[place][j];
            if (isopath.piece_at(adjplace) == '') {
                piece_moves.push(['piece',place,adjplace]);
            }
        }
    }

    var candidate_moves = [];
    for (var i = 0; i < piece_moves.length; i++) {
        // move a brick to facilitate the piece move if necessary, or alternatively the best-scoring as decided by some heuristic
        var from = piece_moves[i][1];
        var to = piece_moves[i][2];

        var tile_moves = [];

        // TODO: a better heuristic to pick 4 good-looking tile moves instead of choosing 4 at random
        if (isopath.board[to] == 1) {
            // need to add/remove a tile in order to move here
            if (isopath.playerlevel[me] == 2) {
                // place a tile here
                tile_moves.push(["tile",this.random_location_at_height(isopath, 1),to]);
                tile_moves.push(["tile",this.random_location_at_height(isopath, 1),to]);
                tile_moves.push(["tile",this.random_location_at_height(isopath, 2),to]);
                tile_moves.push(["tile",this.random_location_at_height(isopath, 2),to]);
            } else {
                // remove the tile here
                tile_moves.push(["tile",to,this.random_location_at_height(isopath, 0)]);
                tile_moves.push(["tile",to,this.random_location_at_height(isopath, 0)]);
                tile_moves.push(["tile",to,this.random_location_at_height(isopath, 1)]);
                tile_moves.push(["tile",to,this.random_location_at_height(isopath, 1)]);
            }

        } else if (isopath.board[to] == isopath.playerlevel[me]) {
            // can move here straight away, need to move a tile elsewhere
            tile_moves.push(["tile",this.random_location_at_height(isopath, 1),this.random_location_at_height(isopath, 0)]);
            tile_moves.push(["tile",this.random_location_at_height(isopath, 1),this.random_location_at_height(isopath, 1)]);
            tile_moves.push(["tile",this.random_location_at_height(isopath, 2),this.random_location_at_height(isopath, 0)]);
            tile_moves.push(["tile",this.random_location_at_height(isopath, 2),this.random_location_at_height(isopath, 1)]);

        } // else {
            // can't move here at all
        //}

        // add all of our considered tile moves and this piece move to the list of candidate moves
        for (var j = 0; j < tile_moves.length; j++) {
            candidate_moves.push([tile_moves[j], piece_moves[i]]);
        }
    }

    var best = {
        move: [],
        score: -FirstSerious.maxscore,
    };

    //console.log("Got " + candidate_moves.length + " moves to try");

    // now try each of the candidate moves, and return the one that scores best
    for (var i = 0; i < candidate_moves.length; i++) {
        // deep-copy the isopath object; this is an extremely inefficient way to go about things
        var new_isopath = isopath.clone();
        try {
            new_isopath.playMove(candidate_moves[i]);
            var response = this.dfs(new_isopath, depth_remaining-1, -beta, -alpha);
            if (-response.score > best.score || !best.move.length) {
                best = {
                    score: -response.score,
                    move: candidate_moves[i],
                };
            }
            if (-response.score > alpha)
                alpha = -response.score;
            if (alpha >= beta)
                break;
        } catch(e) {
            /*console.log("Attempted illegal move: " + e);
            console.log(candidate_moves[i]);
            console.log("---");*/
        };
    }

    return best;
}

FirstSerious.prototype.move = function() {
    var best = this.dfs(this.isopath, 3, -FirstSerious.maxscore, FirstSerious.maxscore);
    console.log(best);
    return best.move;
};

IsopathAI.register_ai('first-serious', 'First serious attempt (WIP)', function(isopath) {
    return new FirstSerious(isopath);
});
