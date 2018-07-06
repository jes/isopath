/* second attempt at an Isopath AI:
 *  - still based on negamax search, with alpha-beta pruning and
 *    transposition tables
 *  - evaluation function and tile selection based on tactics from:
 *    https://incoherency.co.uk/blog/stories/isopath-intro.html
 */

function Padfoot(isopath, constants) {
    this.isopath = isopath;
    this.constants = constants;
    this.searchdepth = 2;
    this.transpos = {nelems: 0};
    this.pathscorememo = {nelems: 0};
}

Padfoot.maxscore = 100000;

// https://stackoverflow.com/a/6274381
Padfoot.prototype.shuffle = function(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

// evaluation:

Padfoot.piece_score = function(place, colour) {
    if (colour == 'black') {
        // just invert the location and then score as if it's white
        place = place.replace('a', 'G').replace('b', 'F').replace('c', 'E')
            .replace('g', 'a').replace('f', 'b').replace('e', 'c')
            .toLowerCase();
    }

    var row = 4 + place.charCodeAt(0) - 'a'.charCodeAt(0);
    return 100 + row*row*10;
};

// this is a copy of the evaluation function from Sirius
Padfoot.prototype.sirius_evaluate = function(isopath) {
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
        whitepieces += Padfoot.piece_score(place, 'white');
        // score us some points for ability to move
        for (var j = 0; j < isopath.adjacent[place]; j++) {
            whitepieces += isopath.board[isopath.adjacent[place][j]];
        }
    }
    for (var i = 0; i < isopath.board['black'].length; i++) {
        var place = isopath.board['black'][i];
        whitepieces -= Padfoot.piece_score(place, 'black');
        // score us some points for ability to move
        for (var j = 0; j < isopath.adjacent[place]; j++) {
            whitepieces -= (2-isopath.board[isopath.adjacent[place][j]]);
        }
    }

    var piecescore = isopath.curplayer == 'white' ? whitepieces : -whitepieces;

    // combine those 2 scores into an evaluation
    var score = tilescore + piecescore;

    return score;
};

Padfoot.prototype.evaluate = function(isopath) {
    var myscore = this.paths_score(isopath, isopath.curplayer);
    var yourscore = this.paths_score(isopath, isopath.other[isopath.curplayer]);

    myscore += this.constants[5] * isopath.board[isopath.curplayer].length;
    yourscore += this.constants[5] * isopath.board[isopath.other[isopath.curplayer]].length;

    // pieces under threat (we only check if your pieces are under threat, because we're about to
    // move and we can just take your piece, whereas we can run away and stop you from taking our piece)
    var underthreat = false;
    for (var i = 0; i < 4; i++) {
        if (i < isopath.board[isopath.other[isopath.curplayer]].length) {
            if (this.num_adjacent(isopath, isopath.curplayer, isopath.board[isopath.other[isopath.curplayer]][i]) >= 2)
                underthreat = true;
        }
    }
    if (underthreat)
        myscore += this.constants[8];

    myscore += Math.random() * 3;
    yourscore += Math.random() * 3;

    myscore += this.constants[10] * this.sirius_evaluate(isopath);

    if (myscore > yourscore)
        return myscore - yourscore * this.constants[6];
    else
        return myscore * this.constants[6] - yourscore;
};

// shortest path:

Padfoot.prototype.cost = function(isopath, player, place) {
    var cost;

    // cost for having to move pieces and tiles
    if (isopath.playerlevel[player] == isopath.board[place] || (isopath.board[place] == 1 && isopath.homerow[isopath.other[player]].indexOf(place) != -1))
        cost = this.constants[0];
    else if (isopath.board[place] == 1)
        cost = this.constants[1];
    else
        cost = this.constants[2];

    // 100 cost if the space is threatened (as long as it's not a game-winning tile)
    if (this.num_adjacent(isopath, isopath.other[player], place) >= 2 && (isopath.homerow[isopath.other[player]].indexOf(place) == -1))
        cost = this.constants[3];

    // 100 cost if the space is occupied
    if (isopath.piece_at(place) != '')
        cost = this.constants[4];

    return cost;
};

Padfoot.prototype.pathscore = function(isopath, src, dstset) {
    var me = isopath.piece_at(src);
    var you = isopath.other[me];

    var key = this.strboard(isopath) + ";" + src + ";" + dstset[0];
    if (this.pathscorememo[key]) {
        return this.pathscorememo[key];
    }

    // computing a path score:
    // edge weights (from this.constants, for):
    //  - moving on to a tile of your height
    //  - moving on to a tile at height 1
    //  - moving on to a tile at opponent height
    //  - moving on to a threatened tile
    //  - moving on to an occupied tile
    // dijkstra then gives us the cost of the paths from src to all points
    // we choose the cost as the minimum cost from src to any point in dstset
    // the *score* of the path is then proportional to 1/cost

    // https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm#Pseudocode
    var q = [];

    var dist = {};
    for (var i = 0; i < isopath.all_places.length; i++) {
        var p = isopath.all_places[i];
        dist[p] = 100000;
        q.push(p);
    }
    dist[src] = 0;

    while (q.length) {
        // find the point in the queue that is nearest to the source
        var u_idx = 0;
        for (var i = 1; i < q.length; i++) {
            if (dist[q[i]] < dist[q[u_idx]])
                u_idx = i;
        }

        // remove this item from the queue
        var u = q[u_idx];
        q.splice(u_idx, 1);

        // for each neighbour of u
        for (var i = 0; i < isopath.adjacent[u].length; i++) {
            var v = isopath.adjacent[u][i];
            var alt = dist[u] + this.cost(isopath, me, v);
            if (alt < dist[v]) {
                dist[v] = alt;
            }
        }
    }

    // find the length of the shortest path to any item in dstset
    var pathlength = 100000;
    for (var i = 0; i < dstset.length; i++) {
        if (dist[dstset[i]] < pathlength)
            pathlength = dist[dstset[i]];
    }

    // if I'm not allowed to move a piece, I'm one step further
    if (isopath.curplayer != me)
        pathlength++;

    if (this.pathscorememo.nelems > 100000)
        this.pathscorememo = {nelems:0};
    this.pathscorememo[key] = this.constants[7] / pathlength;

    // a shorter path scores higher
    return this.constants[7] / pathlength;
};

Padfoot.prototype.paths_score = function(isopath, player) {
    var srcset = isopath.board[player];
    var dstset = isopath.homerow[isopath.other[player]];

    var best = -1000;
    var total = 0;
    for (var i = 0; i < srcset.length; i++) {
        var s = this.pathscore(isopath, srcset[i], dstset);
        total += s;
        if (s > best)
            best = s;
    }

    return best + total * this.constants[9];
};

// tile selection:

// dir must be either -1 or +1
Padfoot.prototype.alter_tiles = function(isopath, dir, max) {
    var tiles = [];
    for (var i = 0; i < isopath.all_places.length; i++) {
        var p = isopath.all_places[i];

        // don't move it below 0 or above 1
        if ((dir == -1 && isopath.board[p] == 0) || (dir == 1 && isopath.board[p] == 2))
            continue;

        // don't touch our own home row
        if (isopath.homerow[isopath.curplayer].indexOf(p) != -1)
            continue;

        // don't move tiles with men on them
        if (isopath.piece_at(p) != '')
            continue;

        // alter the tile, work out what the evaluation would be, restore the tile
        isopath.board[p] += dir;
        var s = this.evaluate(isopath);
        isopath.board[p] -= dir;

        tiles.push([p, s]);
    }

    this.shuffle(tiles);

    // pick the highest-scoring tile-removals first
    tiles.sort(function(a,b) {
        return b[1] - a[1];
    });

    // return the best "max" moves
    var r = [];
    for (var i = 0; i < max && i < tiles.length; i++) {
        r.push(tiles[i][0]);
    }
    return r;
};

Padfoot.prototype.take_tiles = function(isopath, max) {
    return this.alter_tiles(isopath, -1, max);
};
Padfoot.prototype.place_tiles = function(isopath, max) {
    return this.alter_tiles(isopath, 1, max);
};

// search:

// return the number of pieces the given player has adjacent to place
Padfoot.prototype.num_adjacent = function(isopath, player, place) {
    var cnt = 0;

    for (var i = 0; i < isopath.adjacent[place].length; i++) {
        var adj = isopath.adjacent[place][i];
        if (isopath.board[player].indexOf(adj) != -1)
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
    var tilefroms = this.take_tiles(isopath, 3);
    var tiletos = this.place_tiles(isopath, 3);

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
                        var tileto = tiletos[l];
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
        if (this.num_adjacent(isopath, me, opp) < 2)
            continue;

        // capturing this man & then moving a piece
        for (var j = 0; j < immediate_piece_moves.length; j++) {
            moves.push([['capture', opp], immediate_piece_moves[j]]);
        }

        // capturing this man & then moving a tile
        // try every combination of this piece move with all of the best tile moves
        for (var k = 0; k < tilefroms.length; k++) {
            var tilefrom = tilefroms[k];
            for (var l = 0; l < tiletos.length; l++) {
                var tileto = tiletos[l];
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
        if (this.num_adjacent(isopath, me, opp) >= 2) {
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
                        var tilefroms = this.take_tiles(isopath, 2);
                        if (tilefroms[0] == tileto)
                            tilefrom = tilefroms[1];
                        else
                            tilefrom = tilefroms[0];
                    } else {
                        tilefrom = to;
                        var tiletos = this.place_tiles(isopath, 2);
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
    return best.move;
};

IsopathAI.register_ai('padfoot', 'Padfoot', function(isopath) {
    return new Padfoot(isopath, [1,2,3,4,5,6,1,1000,2,2,0.5]);
});
