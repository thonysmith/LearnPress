;(function($){
	var $doc = $(document);
	function _ready(){
		$(document).on('click', '.learn-press-add-ons .plugin-action-buttons a', function(e){
			e.preventDefault();
			var $plugin = $(this).closest('.plugin-card');
			if( $(this).hasClass('button-working') ){
				return;
			}
			$(this).addClass('button-working disabled');
			$.ajax({
				url: $(this).attr('href'),
				data: {},
				success: function(r){
					$.ajax({
						url: window.location.href,
						success: function(r){
							var $p = $(r).find('#'+$plugin.attr('id'));
							if( $p.length ) {
								$plugin.replaceWith($p)
							}
						}
					})
				}
			});
		});
		var $sandbox_mode   = $('#learn_press_paypal_sandbox_mode'),
			$paypal_type    = $('#learn_press_paypal_type');
		$paypal_type.change(function(){
			$('.learn_press_paypal_type_security').toggleClass( 'hide-if-js', 'security' != this.value );
		});
		$sandbox_mode.change(function(){
			this.checked ? $('.sandbox input').removeAttr( 'readonly' ) : $('.sandbox input').attr( 'readonly', true );
		});

		$('#learn_press_paypal_enable').change(function(){
			var $rows = $(this).closest('tr').siblings('tr');
			if( this.checked ){
				$rows.css("display", "");
			}else{
				$rows.css("display", "none");
			}
		}).trigger('change');

		$('.learn-press-toggle-lesson-preview').on('change', function(){
			$.ajax({
				url: LearnPress_Settings.ajax,
				data: {
					action: 'learnpress_toggle_lesson_preview',
					lesson_id: this.value,
					previewable: this.checked ? 'yes' : 'no',
					nonce: $(this).attr('data-nonce')
				},
				dataType: 'text',
				success: function(response){
					response = LearnPress.parseJSON(response);
				}
			});
		});
	}
	$doc.ready(_ready);
})(jQuery);