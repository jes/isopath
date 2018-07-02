/* second attempt at an Isopath AI:
 *  - still based on negamax search, with alpha-beta pruning and
 *    transposition tables
 *  - evaluation function and tile selection based on tactics from:
 *    https://incoherency.co.uk/blog/stories/isopath-intro.html
 */

function Padfoot(isopath) {
    this.isopath = isopath;
    this.searchdepth = 3;
    this.transpos = {nelems: 0};
}

Padfoot.maxscore = 100000;

// evaluation:

Padfoot.prototype.evaluate_for = function(isopath, player) {
    // TODO: this
    return 0;
};

Padfoot.prototype.evaluate = function(isopath) {
    if (isopath.curplayer == 'white')
        return this.evaluate_for(isopath, 'white') - this.evaluate_for(isopath, 'black');
    else
        return this.evaluate_for(isopath, 'black') - this.evaluate_for(isopath, 'white');
};

// tile selection:

Padfoot.prototype.take_tiles = function(max) {
    // TODO: better
    var froms = [];
    for (var i = 0; i < max; i++) {
        var from;
        do {
            from = isopath.all_places[Math.floor(Math.random() * isopath.all_places.length)];
        } while(isopath.board[from] == 0 || isopath.piece_at(from) != '' || isopath.homerow[isopath.curplayer].indexOf(from) != -1);
        froms.push(from);
    }
    return froms;
};

Padfoot.prototype.place_tiles = function(max) {
    // TODO: better
    var tos = [];
    for (var i = 0; i < max; i++) {
        var to;
        do {
            to = isopath.all_places[Math.floor(Math.random() * isopath.all_places.length)];
        } while(isopath.board[to] == 2 || isopath.piece_at(to) != '' || isopath.homerow[isopath.curplayer].indexOf(to) != -1);
        tos.push(to);
    }
    return tos;
};

// search:

// return how many pieces the current player has adjacent to place
Padfoot.prototype.num_adjacent = function(isopath, place) {
    var me = isopath.curplayer;

    var cnt = 0;

    for (var i = 0; i < isopath.adjacent[place].length; i++) {
        var adj = isopath.adjacent[place][i];
        if (isopath.board[me].indexOf(adj) != -1)
            cnt++;
    }

    return cnt;
};

Padfoot.prototype.candidate_moves = function(isopath) {
    var me = isopath.curplayer;
    var you = isopath.other[me];

    var moves = [];
    var immediate_piece_moves = [];

    // find the best places to either place or remove tiles
    // TODO: this choice should actually depend on which piece move we're doing
    // TODO: we should also be able to remove/place a tile on the space we just
    //       moved a man off, in the case of "can move here immediately", or
    //       captured a man from, in the case of a capture
    var tilefroms = this.take_tiles(3);
    var tiletos = this.place_tiles(3);

    // piece moves:
    for (var i = 0; i < isopath.board[me].length; i++) {
        var piecefrom = isopath.board[me][i];

        for (var j = 0; j < isopath.adjacent[piecefrom].length; j++) {
            var pieceto = isopath.adjacent[piecefrom][j];

            if (isopath.board[pieceto] == isopath.playerlevel[me]) {
                // can move here immediately
                // try every combination of this piece move with all of the best tile moves
                for (var k = 0; k < tilefroms.length; k++) {
                    var tilefrom = tilefroms[k];
                    if (tilefrom == pieceto)
                        continue;
                    for (var l = 0; l < tiletos.length; l++) {
                        var tileto = tiletos[k];
                        if (tilefrom != tileto && tileto != pieceto)
                            moves.push([['piece', piecefrom, pieceto], ['tile', tilefrom, tileto]]);
                    }
                }

                // remember that we can move this piece without moving a tile, so
                // that we can do it in combination with a capture
                immediate_piece_moves.push(['piece', piecefrom, pieceto]);
            }

            if (isopath.board[pieceto] == 1 && isopath.playerlevel[me] == 2) {
                // have to move a tile to here before we can step on it
                for (var k = 0; k < tilefroms.length; k++) {
                    var tilefrom = tilefroms[k];
                    if (tilefrom != pieceto)
                        moves.push([['tile', tilefrom, pieceto], ['piece', piecefrom, pieceto]]);
                }
            }

            if (isopath.board[pieceto] == 1 && isopath.playerlevel[me] == 0) {
                // have to move a tile to here before we can step on it
                for (var k = 0; k < tiletos.length; k++) {
                    var tileto = tiletos[k];
                    if (tileto != pieceto)
                        moves.push([['tile', pieceto, tileto], ['piece', piecefrom, pieceto]]);
                }
            }
        }
    }

    // capture moves:
    for (var i = 0; i < isopath.board[you].length; i++) {
        var opp = isopath.board[you][i];

        // can only capture it if we have 2 or more adjacent men
        if (this.num_adjacent(isopath, opp) < 2)
            continue;

        // capturing this man & then moving a piece
        for (var j = 0; j < immediate_piece_moves.length; j++) {
            moves.push([['capture', opp], immediate_piece_moves[i]]);
        }

        // capturing this man & then moving a tile
        // try every combination of this piece move with all of the best tile moves
        for (var k = 0; k < tilefroms.length; k++) {
            var tilefrom = tilefroms[k];
            for (var l = 0; l < tiletos.length; l++) {
                var tileto = tiletos[k];
                if (tilefrom != tileto)
                    moves.push([['capture', opp], ['tile', tilefrom, tileto]]);
            }
        }

    }

    return moves;
};

Padfoot.prototype.instawin_move = function(isopath) {
    var me = isopath.curplayer;
    var you = isopath.other[me];

    // if we can win the game instantly by capturing their final piece, do so
    if (isopath.board[you].length == 1) {
        var opp = isopath.board[you][0];
        if (this.num_adjacent(isopath, opp) >= 2) {
            return {
                move: [["capture",isopath.board[you][0]]],
                score: Padfoot.maxscore,
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
                    // XXX: this tile selection code should be shorter
                    if (isopath.playerlevel[me] == 2) {
                        tileto = to;
                        var tilefroms = this.take_tiles(2);
                        if (tilefroms[0] == tileto)
                            tilefrom = tilefroms[1];
                        else
                            tilefrom = tilefroms[0];
                    } else {
                        tilefrom = to;
                        var tiletos = this.place_tiles(2);
                        if (tiletos[0] == tilefrom)
                            tileto = tiletos[1];
                        else
                            tileto = tiletos[0];
                    }
                    return {
                        move: [["tile",tilefrom,tileto],["piece",from,to]],
                        score: Padfoot.maxscore,
                    };
                } else if (isopath.board[to] == isopath.playerlevel[me]) {
                    // no need to move a tile, step straight there
                    return {
                        move: [["piece",from,to]],
                        score: Padfoot.maxscore,
                    };
                }
            }
        }
    }

    // can't win the game instantly
    return false;
};

// return -1 if move a should be tried before b, or +1 if a should be tried after b
Padfoot.prototype.cmpmove = function(a, b) {
    // TODO: better
    if (a[0][0] == 'capture')
        return -1;
    return 1;
};

Padfoot.prototype.dfs = function(isopath, depth_remaining, alpha, beta) {
    var alphaorig = alpha;

    // if we already know what move to play, play that
    var trans = this.trans_lookup(isopath, depth_remaining, alpha, beta);
    if (trans) {
        alpha = trans.alpha; beta = trans.beta;
        if (trans.move) {
            return {
                score: trans.score,
                move: trans.move,
            };
        }
    }

    // if we can win immediately, do that
    var instawin = this.instawin_move(isopath);
    if (instawin) {
        return {
            score: instawin.score - 20 + depth_remaining, // "-20+depth" means we prefer a sooner win, and a later loss
            move: instawin.move,
        };
    }

    // if this is the limit of the search depth, just return the score and no suggested move
    if (depth_remaining == 0) {
        return {
            move: [],
            score: this.evaluate(isopath),
        };
    }

    // otherwise, generate candidate moves...
    var candidate_moves = this.candidate_moves(isopath);
    // ...sort them to get maximum effect from alpha-beta pruning...
    var isothis = this;
    candidate_moves.sort(function(a,b) {
        return isothis.cmpmove(a,b);
    });
    // ...and search 1 level deeper in the tree.
    var best = {
        move: [],
        score: -Padfoot.maxscore,
    };
    for (var i = 0; i < candidate_moves.length; i++) {
        var m = candidate_moves[i];

        // don't test illegal moves
        if (!isopath.isLegalMove(m))
            continue;

        isopath.playMove(m, 'no-legality-check');
        var response = this.dfs(isopath, depth_remaining-1, -beta, -alpha);
        isopath.undoMove();

        // if the response is worse for the opponent than the response to any other move yet tried,
        // then we've found a new best move for us to play
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

    // save this move in the transposition table
    this.trans_insert(isopath, best, depth_remaining, alphaorig, beta);

    return best;
};

// transposition table:

Padfoot.prototype.strboard = function(isopath) {
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


Padfoot.prototype.trans_lookup = function(isopath, depth_remaining, alpha, beta) {
    // https://en.wikipedia.org/wiki/Negamax#Negamax_with_alpha_beta_pruning_and_transposition_tables
    var trans = this.transpos[this.strboard(isopath)];
    if (trans && trans.depth_remaining >= depth_remaining) {
        if (trans.flag == 'exact') {
            return {
                score: trans.score,
                move: trans.move,
                alpha: alpha,
                beta: beta,
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
                alpha: alpha,
                beta: beta,
            };
        } else {
            return {
                alpha: alpha,
                beta: beta,
            };
        }
    }
};

Padfoot.prototype.trans_insert = function(isopath, move, depth_remaining, alphaorig, beta) {
    // jescache...
    if (this.transpos.nelems > 100000) {
        this.transpos = {nelems: 0};
    }

    // https://en.wikipedia.org/wiki/Negamax#Negamax_with_alpha_beta_pruning_and_transposition_tables
    var ttentry = {
        score: move.score,
        move: move.move,
        depth_remaining: depth_remaining,
    };
    if (move.score <= alphaorig) {
        ttentry.flag = 'upperbound';
    } else if (move.score >= beta) {
        ttentry.flag = 'lowerbound';
    } else {
        ttentry.flag = 'exact';
    }
    this.transpos[this.strboard(isopath)] = ttentry;
    this.transpos.nelems++;
};

// register:

Padfoot.prototype.move = function() {
    var best = this.dfs(this.isopath.clone(), this.searchdepth, -Padfoot.maxscore, Padfoot.maxscore);
    console.log(best);
    return best.move;
};

IsopathAI.register_ai('padfoot', 'Padfoot', function(isopath) {
    return new Padfoot(isopath);
});
