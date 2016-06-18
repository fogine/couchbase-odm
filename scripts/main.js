$(function () {
    var $menu = $('#menu-content');
    var $search = $('#search');
    var $clearSearch = $('.nav-side-menu .clearer');

    var searchTerms = $menu.children('li').map(function() {
        var $this = $(this),
            target = $this.data('target'),
            $child = target ? $this.find(target) : $();

        return {
            $: $this,
            text: $this.find('a:first').text().toLowerCase(),
            sections: $child.find('li').map(function() {
                var $section = $(this);
                return {
                    $: $section,
                    $badge: $section.find('.badge:first'),
                    children: $section.find('a').map(function() {
                        var $child = $(this);
                        return {
                            $: $child,
                            text: $child.text().toLowerCase()
                        };
                    }).toArray()
                };
            }).toArray()
        };
    }).toArray();

    var showAllNav = function() {
        $search.data('previousVal', '');
        searchTerms.forEach(function(item) {
            item.$.show();

            item.sections.forEach(function(section) {
                section.children.forEach(function(child) {
                    child.$.show();
                });

                section.$badge.text(section.children.length);
                section.$.show();
            });
        });
    };
    
    var showSearchResults = function(query) {
        var terms = $.trim(query).split(/[.#~\s]+/);

        searchTerms.forEach(function(item) {
            var itemMatched = someMatch(item.text, terms);
            var sectionMatched = false;

            item.sections.forEach(function(section) {
                var matchedChildren = 0;

                section.children.forEach(function(child) {
                    var matched = (itemMatched && terms.length == 1) || someMatch(child.text, terms);
                    child.$.toggle(matched);

                    if (matched) {
                        matchedChildren++;
                    }
                });

                section.$badge.text(matchedChildren);
                section.$.toggle(matchedChildren > 0);

                if (matchedChildren) {
                    sectionMatched = true;
                }
            });

            var $item = item.$;
            if (itemMatched || sectionMatched) {
                $item.show();
                if ($item.hasClass('collapsed')) {
                    $item.click();
                }
            } else {
                $item.hide();
            }
        });
    };

    var someMatch = function(text, terms) {
        return terms.some(function(term) {
            return text.indexOf(term) >= 0;
        });
    };

    $('.nav-side-menu .menu-content > li a').click(function(e) {
        e.stopPropagation();
    });

    $clearSearch.click(function(e) {
        $search.val('');
        $(this).hide();
        showAllNav();
    });

    $search.keyup(function(e) {
        var $this = $(this),
            preVal = $this.data('previousVal'),
            val = $this.val().toLowerCase(),
            tempMatch = [],
            tempHide = [];

        if (val) {
            $clearSearch.show();
            showSearchResults(val);
        } else {
            $clearSearch.hide();
            showAllNav();
        }
        if ($menu.collapse) {
            $menu.collapse(val ? 'show' : 'hide');
        }
    });

    // Activate sidebar
    var page = window.location.pathname.split('/');
    page = page[page.length - 1];

    var $sideItem = $menu.find('a[href="' + page + '"]:first').parent();
    $sideItem.addClass('active').trigger('click');

    // disqus code
    if (config.disqus) {
        $(window).on('load', function () {
            var disqus_shortname = config.disqus; // required: replace example with your forum shortname
            var dsq = document.createElement('script'); dsq.type = 'text/javascript'; dsq.async = true;
            dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
            (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);
            var s = document.createElement('script'); s.async = true;
            s.type = 'text/javascript';
            s.src = 'http://' + disqus_shortname + '.disqus.com/count.js';
            document.getElementsByTagName('BODY')[0].appendChild(s);
        });
    }
});