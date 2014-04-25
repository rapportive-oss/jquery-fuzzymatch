
jQuery.fuzzyMatch
-----------------

jQuery.fuzzyMatch implements a fuzzy-string-matching algorithm inspired by
QuickSilver and Command-T in javascript.

It is designed for use as part of an autocompleter, where a finite list of
possible strings are to be matched against the few characters that the user has
typed.

It offers some improvement over existing prefix-based matches, though it is
careful to ensure that if a prefix match has been typed, it will be shown
first.


Example
=======

To use this with jQuery.ui.autocomplete, you do:

```javascript

    $("input").autocomplete({
        source: function (context, callback) {
            callback($(['dog', 'cat', 'cow']).filter(function (a) {
                // Only show items which match
                return $.fuzzyMatch(this, context.term).score;
            }).sort(function (a, b) {
                // And sort them by matchiness.
                var score_a = $.fuzzyMatch(a, context.term).score,
                    score_b = $.fuzzyMatch(b, context.term).score;

                return score_a < score_b ? -1 : score_a === score_b ? 0 : 1;
            }));
        },
        delay: 0
    });

```

Meta-foo
========

This is all licensed under the MIT license, contributions are most welcome.
