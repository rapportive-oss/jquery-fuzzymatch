/**
 * jQuery.fuzzyMatch.js, version 0.3 (2011-06-22)
 *
 * https://github.com/rapportive-oss/jquery-fuzzymatch
 *
 * A fuzzy string-matching plugin for autocompleting in jQuery,
 *  based on LiquidMetal    http://github.com/rmm5t/liquidmetal/blob/master/liquidmetal.js
 *           quicksilver.js http://code.google.com/p/rails-oceania/source/browse/lachiecox/qs_score/trunk/qs_score.js
 *           QuickSilver    http://code.google.com/p/blacktree-alchemy/source/browse/trunk/Crucible/Code/NSString_BLTRExtensions.m#61
 *           FuzzyString    https://github.com/dcparker/jquery_plugins/blob/master/fuzzy-string/fuzzy-string.js
 *
 * Copyright (c) 2011, Conrad Irwin (conrad@rapportive.com)
 * Licensed under the MIT: http://www.opensource.org/licenses/mit-license.php
 *
 * TODO: Tweak heuristics, typo correction support?
**/
(function ($) {

    // The scores are arranged so that a continuous match of characters will
    // result in a total score of 1.
    //
    // The best case, this character is a match, and either this is the start
    // of the string, or the previous character was also a match.
    var SCORE_CONTINUE_MATCH = 1,

        // A new match at the start of a word scores better than a new match
        // elsewhere as it's more likely that the user will type the starts
        // of fragments.
        // (Our notion of word includes CamelCase and hypen-separated, etc.)
        SCORE_START_WORD = 0.9,

        // Any other match isn't ideal, but it's probably ok.
        SCORE_OK = 0.8,

        // The goodness of a match should decay slightly with each missing
        // character.
        //
        // i.e. "bad" is more likely than "bard" when "bd" is typed.
        //
        // This will not change the order of suggestions based on SCORE_* until
        // 100 characters are inserted between matches.
        PENALTY_SKIPPED = 0.999,

        // The goodness of an exact-case match should be higher than a
        // case-insensitive match by a small amount.
        //
        // i.e. "HTML" is more likely than "haml" when "HM" is typed.
        //
        // This will not change the order of suggestions based on SCORE_* until
        // 1000 characters are inserted between matches.
        PENALTY_CASE_MISMATCH = 0.9999,

        // If the word has more characters than the user typed, it should
        // be penalised slightly.
        //
        // i.e. "html" is more likely than "html5" if I type "html".
        //
        // However, it may well be the case that there's a sensible secondary
        // ordering (like alphabetical) that it makes sense to rely on when
        // there are many prefix matches, so we don't make the penalty increase
        // with the number of tokens.
        PENALTY_NOT_COMPLETE = 0.99;

    /**
     * Generates all possible split objects by splitting a string around a 
     * character in as many ways as possible.
     *
     * @param string The string to split
     * @param char   A character on which to split it.
     *
     * @return [{
     *   before: The fragment of the string before this occurance of the
     *           character.
     *
     *   char: The original coy of this character (which may differ in case
     *         from the "char" parameter).
     *
     *   after: The fragment of the string after the occurance of the character.
     * }]
    **/
    function allCaseInsensitiveSplits(string, chr) {
        var lower = string.toLowerCase(),
            lchr = chr.toLowerCase(),

            i = lower.indexOf(lchr),
            result = [];

        while (i > -1) {
            result.push({
                before: string.slice(0, i),
                chr: string.charAt(i),
                after: string.slice(i + 1)
            });

            i = lower.indexOf(lchr, i + 1);
        }
        return result;
    }

    /**
     * Escapes a string so that it can be interpreted as HTML node content.
     *
     * WARNING: The output isn't safe for including in attributes, and I
     *          haven't considered other HTML contexts.
     * NOTE: This really is worth it compared to using $('<div>').text(foo).html().
     *
     * @param string, the string to escape
     * @return string, the escaped version.
     */
    function htmlEscape(string) {
        return string.replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;');
    }

    /**
     * Generates a case-insensitive match of the abbreviation against the string
     *
     * @param string, a canonical string to be matched against.
     * @param abbreviation, an abbreviation that a user may have typed
     *                      in order to specify that string.
     *
     * @cache (private), a cache that reduces the expected running time of the
     *                   algorithm in the case there are many repeated characters.
     *
     * @return {
     *    score:  A score (0 <= score <= 1) that indicates how likely it is that
     *            the abbreviation matches the string.
     *
     *            The score is 0 if the characters in the abbreviation do not
     *            all appear in order in the string.
     *
     *            The score is 1 if the user typed the exact string.
     *
     *            Scores are designed to be comparable when many different
     *            strings are matched against the same abbreviation, for example
     *            for autocompleting.
     *
     *    html:   A copy of the input string html-escaped, with matching letters
     *            surrounded by <b> and </b>.
     *
     * }
    **/
    $.fuzzyMatch = function (string, abbreviation, cache) {
        if (abbreviation === "") {
            return {
                score: string === "" ? SCORE_CONTINUE_MATCH : PENALTY_NOT_COMPLETE,
                html: htmlEscape(string)
            };
        }

        if (cache && cache[string] && cache[string][abbreviation]) {
            return $.extend({}, cache[string][abbreviation]);
        }

        cache = cache || {};
        cache[string] = cache[string] || {};
        cache[string][abbreviation] =

           $(allCaseInsensitiveSplits(string, abbreviation.charAt(0)))
            .map(function (i, split) {
                var result = $.fuzzyMatch(split.after, abbreviation.slice(1), cache),
                    preceding_char = split.before.charAt(split.before.length - 1);

                if (split.before === "") {
                    result.score *= SCORE_CONTINUE_MATCH;

                } else if (preceding_char.match(/[\\\/\-_+.# \t"@\[\(\{&]/) ||
                        (split.chr.toLowerCase() !== split.chr && preceding_char.toLowerCase() === preceding_char)) {

                    result.score *= SCORE_START_WORD;
                } else {
                    result.score *= SCORE_OK;
                }

                if (split.chr !== abbreviation.charAt(0)) {
                    result.score *= PENALTY_CASE_MISMATCH;
                }

                result.score *= Math.pow(PENALTY_SKIPPED, split.before.length);
                result.html = htmlEscape(split.before) + '<b>' + htmlEscape(split.chr) + '</b>'  + result.html;

                return result;
            })
            .sort(function (a, b) {
                return a.score < b.score ? 1 : a.score === b.score ? 0 : -1;
            })[0] ||

            // No matches for the next character in the abbreviation, abort!
            {
                score: 0, // This 0 will multiply up to the top, giving a total of 0
                html: htmlEscape(string)
            };

        return $.extend({}, cache[string][abbreviation]);
    };
/*global jQuery */
}(jQuery));
