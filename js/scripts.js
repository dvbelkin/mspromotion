$(document).ready(function(){

	// скрипт адаптивного меню
	$(function() {
		var pull        = $('.toggleMenu');
				menu        = $('.top-nav ul');
				menuHeight  = menu.height();

		$(pull).on('click', function(e) {
			e.preventDefault();
			menu.slideToggle();
		});
	});

    bussinesEventClick = function (){
        var test = $('.hide_block')[0];
        console.log(test.style.display);

		if (test.style.display == "none") {
            test.style.display = 'inline';
            test.style.animation = 'showDiv 2s forwards';

		} else {
            test.style.display = 'none';
		}

	};
	
});