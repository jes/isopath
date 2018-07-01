/* second attempt at an Isopath AI:
 *  - still based on negamax search, with alpha-beta pruning and
 *    transposition tables
 *  - evaluation function and tile selection based on tactics from:
 *    https://incoherency.co.uk/blog/stories/isopath-intro.html
 */

function Padfoot(isopath) {
    this.isopath = isopath;
    this.searchdepth = 3;
}

Padfoot.maxscore = 100000;

Padfoot.prototype.move = function() {
    var best = this.dfs(this.isopath.clone(), this.searchdepth, -Padfoot.maxscore, Padfoot.maxscore);
    console.log(best);
    return best.move;
};

IsopathAI.register_ai('padfoot', 'Padfoot', function(isopath) {
    return new Padfoot(isopath);
});
