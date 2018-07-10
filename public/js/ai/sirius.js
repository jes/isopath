/* first serious attempt at an Isopath AI:
 *  - based on a negamax search, but cutting down the search space
 *    by not searching every possibility of tile placement
 *  - algorithm is mostly as intended, but efficiency is poor
 */

function Sirius(isopath, searchdepth) {
    this.isopath = isopath;
    this.searchdepth = searchdepth;
    this.saved_moves = [];
    this.transpos = {nelems: 0};
    this.bestmovetype = {};
    this.triedmovetype = {};
}

Sirius.piece_score = function(place, colour) {
    if (colour == 'black') {
        // just invert the location and then score as if it's white
        place = place.replace('a', 'G').replace('b', 'F').replace('c', 'E')
            .replace('g', 'a').replace('f', 'b').replace('e', 'c')
            .toLowerCase();
    }

    var row = 4 + place.charCodeAt(0) - 'a'.charCodeAt(0);
    return 100 + row*row*10;
};

Sirius.maxscore = 100000;
Sirius.prototype.evaluate = function(isopath) {
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

    // small bonus for middle row
    for (var col = 1; col <= 7; col++) {
        whitetiles += (2-isopath.board["d" + col]);
        whitetiles -= isopath.board["d" + col];
    }

    var tilescore = isopath.curplayer == 'white' ? whitetiles : -whitetiles;

    // one score for piece values for each player
    var whitepieces = 0;
    for (var i = 0; i < isopath.board['white'].length; i++) {
        var place = isopath.board['white'][i];
        whitepieces += Sirius.piece_score(place, 'white');
        // score us some points for ability to move
        for (var j = 0; j < isopath.adjacent[place]; j++) {
            whitepieces += isopath.board[isopath.adjacent[place][j]];
        }
    }
    for (var i = 0; i < isopath.board['black'].length; i++) {
        var place = isopath.board['black'][i];
        whitepieces -= Sirius.piece_score(place, 'black');
        // score us some points for ability to move
        for (var j = 0; j < isopath.adjacent[place]; j++) {
            whitepieces -= (2-isopath.board[isopath.adjacent[place][j]]);
        }
    }

    var piecescore = isopath.curplayer == 'white' ? whitepieces : -whitepieces;

    // TODO: some extra part of piecescore based on the shortest path for this piece
    // to get to a free slot on the enemy's home row, counting number of turns

    // combine those 2 scores into an evaluation
    var score = tilescore + piecescore;

    if (score > Sirius.maxscore || score < -Sirius.maxscore)
        console.log("Generated score " + score + " out of range; adjust maxscore?");

    return score;
};

// XXX: h should be either [0,1] when placing a tile or [1,2] when removing one
Sirius.prototype.locations_at_heights = function(isopath, h) {
    var p = isopath.all_places;
    var possible = [];

    for (var i = 0; i < p.length; i++) {
        // needs to be an allowable height, and can't have a piece on it
        if (h.indexOf(isopath.board[p[i]]) == -1 || isopath.piece_at(p[i]) != '')
            continue;
        // can't touch our own home row
        if (isopath.homerow[isopath.curplayer].indexOf(p[i]) != -1)
            continue;

        if (isopath.playerlevel[isopath.curplayer] == 2) {
            // white doesn't want to take off black home row
            if (h[0] != 0 && isopath.homerow[isopath.other[isopath.curplayer]].indexOf(p[i]) != -1)
                continue;
        } else {
            // black doesn't want to place on white home row
            if (h[0] == 0 && isopath.homerow[isopath.other[isopath.curplayer]].indexOf(p[i]) != -1)
                continue;
        }
        possible.push(p[i]);
    }

    // XXX: what better can we do here? is this even possible?
    if (possible.length == 0)
        return 'xx';

    return possible;
};

Sirius.prototype.strboard = function(isopath) {
    var s = '';
    for (var i = 0; i < isopath.all_places.length; i++) {
        s += "" + isopath.board[isopath.all_places[i]];
    }
    s += ";";
    for (var i = 0; i < isopath.board['white'].length; i++) {
        s += isopath.board['white'][i];
    }
    s += ";";
    for (var i = 0; i < isopath.board['black'].length; i++) {
        s += isopath.board['black'][i];
    }
    s += ";" + isopath.curplayer;
    return s;
};

Sirius.prototype.dfs = function(isopath, depth_remaining, alpha, beta) {
    // if they've just won, we've lost
    if (isopath.winner()) {
        throw "game shouldn't have ended";
    }

    // TODO: instead of re-building these at each invocation of dfs(), just keep
    // track of it every time we play or undo a move
    var possiblefrom = this.locations_at_heights(isopath, [1,2]);
    var possibleto = this.locations_at_heights(isopath, [0,1]);

    function randtilefrom() {
        return possiblefrom[Math.floor(Math.random() * possiblefrom.length)];
    }
    function randtileto() {
        return possibleto[Math.floor(Math.random() * possibleto.length)];
    }

    alphaorig = alpha;

    // https://en.wikipedia.org/wiki/Negamax#Negamax_with_alpha_beta_pruning_and_transposition_tables
    var trans = this.transpos[this.strboard(isopath)];
    if (trans && trans.depth_remaining >= depth_remaining) {
        if (trans.flag == 'exact') {
            return {
                score: trans.score,
                move: trans.move,
            };
        } else if (trans.flag == 'lowerbound' && trans.score > alpha) {
            alpha = trans.score;
        } else if (trans.flag == 'upperboard' && trans.score < beta) {
            beta = trans.score;
        }
        if (alpha >= beta) {
            return {
                score: trans.score,
                move: trans.move,
            };
        }
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
                score: Sirius.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
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
                            tilefrom = randtilefrom();
                        } while (tilefrom == tileto);
                    } else {
                        tilefrom = to;
                        do {
                            tileto = randtileto();
                        } while (tileto == tilefrom);
                    }
                    return {
                        move: [["tile",tilefrom,tileto],["piece",from,to]],
                        score: Sirius.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
                    };
                } else if (isopath.board[to] == isopath.playerlevel[me]) {
                    // no need to move a tile, step straight there
                    return {
                        move: [["piece",from,to]],
                        score: Sirius.maxscore - 20 + depth_remaining, // "- 20 + depth_remaining" means we prefer an earlier win over a later one
                    };
                }
            }
        }
    }

    // if this is the limit of the search depth, just return the score
    if (depth_remaining == 0) {
        return {
            move: [],
            score: this.evaluate(isopath),
        };
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
            var m, cnt = 0;
            do {
                do {
                    tilefrom = randtilefrom();
                    tileto = randtileto();
                } while (tileto == tilefrom);
                m = [["capture",isopath.board[you][i]],["tile",tilefrom,tileto]];
            } while (!isopath.isLegalMove(m) && ++cnt < 5);
            m.push("capture");
            candidate_moves.push(m);
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
                tile_moves.push(["tile",randtilefrom(),to]);
            } else {
                // remove the tile here
                tile_moves.push(["tile",to,randtileto()]);
            }

        } else if (isopath.board[to] == isopath.playerlevel[me]) {
            // can move here straight away, need to move a tile elsewhere
            var tileto, tilefrom;
            do {
                tilefrom = randtilefrom();
                tileto = randtileto();
            } while (tileto == tilefrom);
            tile_moves.push(["tile",tilefrom,tileto]);

        } else if (already_valid_piece_moves.length > 0) {
            var m, cnt = 0;
            // can't move here at all
            // add/remove a tile so that we might be able to move here next turn
            do {
                if (isopath.playerlevel[me] == 2) {
                    // place a tile here
                    m = [["tile",randtilefrom(),to],already_valid_piece_moves[Math.floor(Math.random() * already_valid_piece_moves.length)]];
                } else {
                    // remove the tile here
                    m = [["tile",to,randtileto()],already_valid_piece_moves[Math.floor(Math.random() * already_valid_piece_moves.length)]];
                }
            } while (!isopath.isLegalMove(m) && ++cnt < 5);
            m.push("cantmovehere");
            candidate_moves.push(m);
        }

        // add all of our considered tile moves and this piece move to the list of candidate moves
        for (var j = 0; j < tile_moves.length; j++) {
            candidate_moves.push([tile_moves[j], piece_moves[i],"tilemoveto" + isopath.board[to]]);
        }
    }

    // TODO: track which "generator" the most decisive moves come from, and increase the
    // amount of moves that that generator is allowed to generate?

    var best = {
        move: [],
        score: -Sirius.maxscore,
    };

    //console.log("Got " + candidate_moves.length + " moves to try");

    // order moves: we want the best moves to be tried first in order to take most
    // advantage of alpha-beta pruning
    // (this is a performance improvement rather than a play-style improvement, modulo
    // the extent to which improved performance allows deeper search)
    candidate_moves.sort(function(a,b) {
        // try captures first
        if (a[0][0] == 'capture')
            return -1;
        if (b[0][0] == 'capture')
            return 1;

        if (a[1] == undefined)
            return 1;
        if (b[1] == undefined)
            return -1;

        var quality = {
            capture: 10,
            tilemoveto1: 9,
            cantmovehere: 8,
            tilemoveto0: 7, // XXX: to0 and to2 should be swapped if playing as black
            tilemoveto2: 6,
        };
        if (a[3] != b[3])
            return quality[b[3]] - quality[a[3]];


        // if not a capture, _[0] is a tile move and _[1] is a piece move

        // try to advance towards the opponent's home row
        if (me == 'white')
            return b[1][1].charCodeAt(0) - a[1][1].charCodeAt(0);
        else
            return a[1][1].charCodeAt(0) - b[1][1].charCodeAt(0);

        // how else could we order moves?
        return 0;
    });

    var tried = {};
    // now try each of the candidate moves, and return the one that scores best
    for (var i = 0; i < candidate_moves.length; i++) {
        var movetype = 'unknown';
        if (candidate_moves[i].length == 3) {
            movetype = candidate_moves[i].pop();
        }

        // don't test duplicate moves
        if (tried[JSON.stringify(candidate_moves[i])])
            continue;
        tried[JSON.stringify(candidate_moves[i])] = true;

        // or illegal moves
        if (!isopath.isLegalMove(candidate_moves[i]))
            continue;

        if (!this.triedmovetype[movetype])
            this.triedmovetype[movetype] = 0;
        this.triedmovetype[movetype]++;

        isopath.playMove(candidate_moves[i], 'no-legality-check');
        var response = this.dfs(isopath, depth_remaining-1, -beta, -alpha);
        isopath.undoMove();

        if (-response.score > best.score || best.move.length == 0) {
            best = {
                score: -response.score,
                move: candidate_moves[i],
                type: movetype,
            };
        }

        if (-response.score > alpha)
            alpha = -response.score;
        if (alpha >= beta)
            break;
    }

    // jescache...
    if (this.transpos.nelems > 50000) {
        this.transpos = {nelems: 0};
    }

    // https://en.wikipedia.org/wiki/Negamax#Negamax_with_alpha_beta_pruning_and_transposition_tables
    var ttentry = {
        score: best.score,
        move: best.move,
        depth_remaining: depth_remaining,
    };
    if (best.score <= alphaorig) {
        ttentry.flag = 'upperbound';
    } else if (best.score >= beta) {
        ttentry.flag = 'lowerbound';
    } else {
        ttentry.flag = 'exact';
    }
    this.transpos[this.strboard(isopath)] = ttentry;
    this.transpos.nelems++;

    if (!this.bestmovetype[best.type])
        this.bestmovetype[best.type] = 0;
    this.bestmovetype[best.type]++;

    return best;
}

Sirius.prototype.move = function() {
    var best = this.dfs(this.isopath.clone(), this.searchdepth, -Sirius.maxscore, Sirius.maxscore);
    console.log(best);
    console.log(this.bestmovetype);
    console.log(this.triedmovetype);
    return best.move;
};

IsopathAI.register_ai('sirius', 'Sirius', function(isopath) {
    return new Sirius(isopath, 6);
});
IsopathAI.register_ai('sirius-fast', 'Sirius (weaker)', function(isopath) {
    return new Sirius(isopath, 4);
});
