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
        place = place.replace('a', 'G').replace('b', 'F').replace('c', 'E')
            .replace('g', 'a').replace('f', 'b').replace('e', 'c')
            .toLowerCase();
    }

    var row = 4 + place.charCodeAt(0) - 'a'.charCodeAt(0);
    return 100 + row*row*10;
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
            whitetiles -= 2;
        if (isopath.board["g" + col] != 0)
            whitetiles += 2;
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
        // score us some points for ability to move
        for (var j = 0; j < isopath.adjacent[place]; j++) {
            whitepieces += isopath.board[isopath.adjacent[place][j]];
        }
    }
    for (var i = 0; i < isopath.board['black'].length; i++) {
        var place = isopath.board['black'][i];
        whitepieces -= FirstSerious.piece_score(place, 'black');
        // score us some points for ability to move
        for (var j = 0; j < isopath.adjacent[place]; j++) {
            whitepieces -= (2-isopath.board[isopath.adjacent[place][j]]);
        }
    }

    var piecescore = isopath.curplayer == 'white' ? whitepieces : -whitepieces;

    // TODO: some extra part of piecescore based on the shortest path for this piece
    // to get to a free slot on the enemy's home row, counting number of turns

    // combine those 2 scores into an evaluation
    return tilescore + piecescore;
};

// TODO: since this function is only used to pick places to take/remove tiles,
// replace it with something that will be more intelligent about it
FirstSerious.prototype.random_location_at_height = function(isopath, h) {
    var p = isopath.all_places;
    var possible = [];

    var type;
    if (h.indexOf(0))
        type = 'put';
    else
        type = 'take';

    for (var i = 0; i < p.length; i++) {
        // needs to be an allowable height, and can't have a piece on it
        if (h.indexOf(isopath.board[p[i]]) == -1 || isopath.piece_at(p[i]) != '')
            continue;
        // can't build on own home row
        if (isopath.homerow[isopath.curplayer].indexOf(p[i]) != -1)
            continue;
        // don't want to take from opponent home row
        if (type == 'take' && isopath.homerow[isopath.other[isopath.curplayer]].indexOf(p[i]) != -1)
            continue;
        possible.push(p[i]);
    }

    // XXX: what better can we do here? is this even possible?
    if (possible.length == 0)
        return 'xx';

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
        throw "game shouldn't have ended";
    }

    var me = isopath.curplayer;
    var you = isopath.other[me];

    // if we can win the game instantly by capturing their final piece, do so
    if (isopath.board[you].length == 1) {
        var adjacent_men = 0;
        var adjs = isopath.adjacent[isopath.board[you][0]];
        for (var i = 0; i < adjs.length; i++) {
            if (isopath.piece_at(adjs[i]) == me)
                adjacent_men++;
        }

        if (adjacent_men >= 2) {
            return {
                move: [["capture",isopath.board[you][0]]],
                score: FirstSerious.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
            };
        }
    }

    // if we can win the game instantly by moving onto their home row, do so
    for (var i = 0; i < isopath.board[me].length; i++) {
        var from = isopath.board[me][i];
        var adjs = isopath.adjacent[from];
        for (var j = 0; j < adjs.length; j++) {
            var to = adjs[j];
            if (isopath.homerow[you].indexOf(to) != -1 && isopath.piece_at(to) == '') {
                // our piece at 'from' is adjacent to the location 'to' which is an unoccupied tile on our opponent's home row
                if (isopath.board[to] == 1) {
                    // move a tile and then move on to the location
                    var tileto, tilefrom;
                    if (isopath.playerlevel[me] == 2) {
                        tileto = to;
                        do {
                            tilefrom = this.random_location_at_height(isopath, [1,2]);
                        } while (tilefrom == tileto);
                    } else {
                        tilefrom = to;
                        do {
                            tileto = this.random_location_at_height(isopath, [0,1]);
                        } while (tileto == tilefrom);
                    }
                    return {
                        move: [["tile",tilefrom,tileto],["piece",from,to]],
                        score: FirstSerious.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
                    };
                } else if (isopath.board[to] == isopath.playerlevel[me]) {
                    // no need to move a tile, step straight there
                    return {
                        move: [["piece",from,to]],
                        score: FirstSerious.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
                    };
                }
            }
        }
    }

    // generate candidate moves:

    var candidate_moves = [];

    // capture moves
    // TODO: also consider moving a piece instead of a tile in the second half of the capture move, where possible
    for (var i = 0; i < isopath.board[you].length; i++) {
        var adjacent_men = 0;
        var adjs = isopath.adjacent[isopath.board[you][i]];
        for (var j = 0; j < adjs.length; j++) {
            if (isopath.piece_at(adjs[j]) == me)
                adjacent_men++;
        }

        // if this man is capturable, consider capturing him, and then move a random 1-level tile to another 1-level place
        if (adjacent_men >= 2) {
            var tileto, tilefrom;
            do {
                tilefrom = this.random_location_at_height(isopath,[1,2]);
                tileto = this.random_location_at_height(isopath,[0,1]);
            } while (tileto == tilefrom);
            candidate_moves.push([["capture",isopath.board[you][i]],["tile",tilefrom,tileto]]);
        }
    }

    var piece_moves = [];
    var already_valid_piece_moves = [];
    // try moving each of our pieces into each adjacent location
    for (var i = 0; i < isopath.board[me].length; i++) {
        var place = isopath.board[me][i];
        for (var j = 0; j < isopath.adjacent[place].length; j++) {
            var adjplace = isopath.adjacent[place][j];
            if (isopath.piece_at(adjplace) == '') {
                piece_moves.push(['piece',place,adjplace]);
                if (isopath.board[adjplace] == isopath.playerlevel[me]) {
                    already_valid_piece_moves.push(['piece',place,adjplace]);
                }
            }
        }
    }

    for (var i = 0; i < piece_moves.length; i++) {
        // move a brick to facilitate the piece move if necessary, or alternatively the best-scoring as decided by some heuristic
        var from = piece_moves[i][1];
        var to = piece_moves[i][2];

        var tile_moves = [];

        // TODO: a better heuristic to pick 4 good-looking tile moves instead of choosing 4 at random (i.e. use knowledge of
        // the evaluation function to try to pick the best places to put them)
        if (isopath.board[to] == 1) {
            // need to add/remove a tile in order to move here
            if (isopath.playerlevel[me] == 2) {
                // place a tile here
                tile_moves.push(["tile",this.random_location_at_height(isopath, [1,2]),to]);
            } else {
                // remove the tile here
                tile_moves.push(["tile",to,this.random_location_at_height(isopath, [0,1])]);
            }

        } else if (isopath.board[to] == isopath.playerlevel[me]) {
            // can move here straight away, need to move a tile elsewhere
            tile_moves.push(["tile",this.random_location_at_height(isopath, [1,2]),this.random_location_at_height(isopath, [0,1])]);

        } else if (already_valid_piece_moves.length > 0) {
            // can't move here at all
            // add/remove a tile so that we might be able to move here next turn
            if (isopath.playerlevel[me] == 2) {
                // place a tile here
                candidate_moves.push([["tile",this.random_location_at_height(isopath, [1,2]),to],already_valid_piece_moves[Math.floor(Math.random() * already_valid_piece_moves.length)]]);
            } else {
                // remove the tile here
                candidate_moves.push([["tile",to,this.random_location_at_height(isopath, [0,1])],already_valid_piece_moves[Math.floor(Math.random() * already_valid_piece_moves.length)]]);
            }
        }

        // add all of our considered tile moves and this piece move to the list of candidate moves
        for (var j = 0; j < tile_moves.length; j++) {
            candidate_moves.push([tile_moves[j], piece_moves[i]]);
        }
    }

    // try blocking an enemy piece
    for (var i = 0; i < isopath.board[you].length; i++) {
        var adjs = isopath.adjacent[isopath.board[you][i]];
        for (var k = 0; k < adjs.length; k++) {
            var adj_opponent = adjs[k];
            if (isopath.board[adj_opponent] != isopath.playerlevel[me]) {
                if (isopath.playerlevel[me] == 2) {
                    // add a tile here
                    candidate_moves.push([["tile",this.random_location_at_height(isopath, [1,2]),adj_opponent],already_valid_piece_moves[Math.floor(Math.random() * already_valid_piece_moves.length)]]);
                } else {
                    // remove a tile here
                    candidate_moves.push([["tile",adj_opponent,this.random_location_at_height(isopath, [0,1])],already_valid_piece_moves[Math.floor(Math.random() * already_valid_piece_moves.length)]]);
                }
            }
        }
    }

    // TODO: track which "generator" the most decisive moves come from, and increase the
    // amount of moves that that generator is allowed to generate?

    var best = {
        move: [],
        score: -FirstSerious.maxscore,
    };

    //console.log("Got " + candidate_moves.length + " moves to try");

    // TODO: sort moves; we want to evaluate the best moves first to take most advantage
    // of alpha-beta pruning

    // now try each of the candidate moves, and return the one that scores best
    for (var i = 0; i < candidate_moves.length; i++) {
        if (!isopath.isLegalMove(candidate_moves[i]))
            continue;
        isopath.playMove(candidate_moves[i]);
        var response = this.dfs(isopath, depth_remaining-1, -beta, -alpha);
        isopath.undoMove();

        if (-response.score > best.score || best.move.length == 0) {
            best = {
                score: -response.score,
                move: candidate_moves[i],
            };
        }

        if (-response.score > alpha)
            alpha = -response.score;
        if (alpha >= beta)
            break;
    }

    return best;
}

FirstSerious.prototype.move = function() {
    var best = this.dfs(this.isopath, 5, -FirstSerious.maxscore, FirstSerious.maxscore);
    console.log(best);
    return best.move;
};

IsopathAI.register_ai('first-serious', 'First serious attempt (WIP)', function(isopath) {
    return new FirstSerious(isopath);
});
