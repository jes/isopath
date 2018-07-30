Stone.addCatalogs(catalogs);
var _ = Stone.gettext;
$(document).ready(function () {
    Stone.enableDomScan(true);
    Stone.setBestMatchingLocale();
    Stone.updateDomTranslation();
});
