;(function($){
	if( typeof LearnPress == 'undefined' ){
		LearnPress = {};
	}
	$(document).ready(function(){
		if( typeof Backbone == 'undefined' ) return;
		var LP_Curriculum_Model = window.LP_Curriculum_Model = Backbone.Model.extend({
			defaults           : {
			},
			data               : null,
			view               : false,
			urlRoot            : '',
			initialize         : function () {
			},
			removeItem: function(item){
				var items = this.get('selectedItems');
				items = _.without( items, item );
				this.set('selectedItems', items);
			},
			addItem: function(id){
				var items = this.get('selectedItems');
				items.push( id );
				this.set('selectedItems', items);
			}
		});

		var LP_Curriculum_View = window.LP_Curriculum_View = Backbone.View.extend({
			model          : {},
			events         : {
				'keyup' : 'processKeyEvents',
				'click .lp-section-item .lp-remove': '_removeItem',
				'click .lp-toggle': 'toggleSection',
				'click .lp-course-curriculum-toggle a': 'toggleSections',
				'keyup input.no-submit': 'onEnterInput',
				'keydown': 'preventSubmit',
				'click .lp-add-buttons button': 'sectionActionHandler',
				'click .lp-item-new .handle': 'toggleItemType',
				'click .lp-button-add-item': '_addNewItem',
				'click .item-bulk-actions button': 'sectionBulkActions',
				'change .item-checkbox input': 'toggleButtonBulkActions'
			},
			removeSectionIds : [],
			removeItemIds: [],
			el             : '#lp-course-curriculum',
			initialize: function( model ){
				if( this.$el.length == 0 ) return;
				this.model = model;
				this.model.view = this;
				this.listenTo(this.model, 'change', this.render);
				this.render();
				_.bindAll(this, 'render', 'searchItem', 'addItemsToSection', 'addItemToSection', 'addNewItem', 'toggleAddItemButtonState' );
				this.initPage();
				LearnPress.Hook.addAction( 'learn_press_message_box_before_resize', this.resetModalSearch)
				LearnPress.Hook.addAction( 'learn_press_message_box_resize', this.updateModalSearch)
			},
			updateModalSearch: function(height, $app){
				$('.lp-modal-search ul').css('height', height - 120).css('overflow', 'auto');
			},
			resetModalSearch: function($app){
				$('.lp-modal-search ul').css('height', '').css('overflow', '')
			},
			initPage: function(){
				var that = this;
				this.$form = $('#post');
				this.$form.on( 'submit', $.proxy( function(e){
					if( $(e.target).hasClass('no-submit') ){
						return false;
					}
					return this.onSave()
				}, this ) );
				$('input[name="_lp_course_result"]').bind('click change', function(){
					return;
					if( $(this).val() == 'yes' ){
						$(this).closest('.rwmb-field').next().show();
					}else{
						$(this).closest('.rwmb-field').next().hide();
					}
				}).filter(":checked").trigger('change');

				///////////
				var $checked = null;
				$checked = $('input[name="_lp_enroll_requirement"]').bind('click change', function () {

					var payment_field = $('.lp-course-payment-field').toggleClass('hide-if-js', !( $(this).val() != 'no' ));
					if (payment_field.is(':visible')) {
						$('input[name="_lp_payment"]:checked', payment_field).trigger('change')
					} else {
						$('.lpr-course-price-field').addClass('hide-if-js');
					}

				});
				$checked.filter(':checked').trigger('change');
				if ($checked.length == 0) {
					$('input[name="_lp_enroll_requirement"][value="yes"]').trigger('click');
				}

				$('input[name="_lp_payment"]').bind('click change', function () {
					$('.lp-course-price-field').toggleClass('hide-if-js', !( $(this).val() != 'free' ) || ( $('input[name="_lp_enroll_requirement"]:checked').val() == 'no' ));
				}).filter(':checked').trigger('change');

				$checked.closest('.rwmb-field').removeClass('hide-if-js');
				////////////////

				$(document).on('mouseover', '.lp-modal-search li', function(){
					$(this).addClass('highlighting').siblings().removeClass('highlighting');
				}).on('click', '.lp-modal-search li', function(e){
					e.keyCode = 13;
					e.target = $(this).closest('.lp-section-item').find('.lp-item-name').get(0)
					that.searchQuizFormKeyEvents(e);
				});
				this.$el
					.on('focus', '.lp-item-name', function(){
						that.$('.lp-section-item').removeClass('hover');
						$(this).parent().addClass('hover')
					})
					.on('blur', '.lp-item-name', function(){
						var $e = $(this);
						setTimeout( function(){
							var $item = $e.closest('.lp-section-item');
							if(that.isShowing != 'searchQuizForm') {
								$item.removeClass('hover');
							}
							if( ($e.val() + '').length == 0 ){
								if( $item.hasClass('lp-item-new') ) {
									///$item.remove();
								}else{
									$e.val( $item.attr('data-text' ));
								}
							}
						}, 500);
					});
				this.$('.lp-curriculum-sections').sortable({
					axis: 'y',
					items: 'li:not(.lp-empty-section)',
					handle: '.lp-section-icon',
					start: function(e, ui){
						$('.lp-curriculum-section-content').css('display', 'none');
						$(ui.item).addClass('lp-sorting');
					},
					stop: function(e, ui){
						$('.lp-curriculum-section-content').css('display', '');
						$(ui.item).removeClass('lp-sorting');
					}
				});
				this.$('.lp-curriculum-sections .lp-section-items').sortable({
					axis: 'y',
					items: 'li:not(.lp-item-empty)',
					handle: '.lp-sort-item',
					connectWith: '.lp-section-items'
				});
				if( this.$('.lp-curriculum-section-content:visible').length ){

				}

				$('#postbox-container-2').prepend( $('#course_tabs') );
				$('#course_tabs #course-tabs-h3 a').click(function(e){
					e.preventDefault();
					var id = $(this).attr('href'),
						$box = $(id);
					$(window).scrollTop($box.offset().top -120);
				});
				$('<div id="course_tabs_placeholder" />').insertAfter($('#course_tabs'));

				$(document)
					.on('keyup', '.lp-modal-search input[name="lp-item-name"]', this.searchItem)
					.on('click change', '.lp-modal-search input[type="checkbox"]', this.toggleAddItemButtonState)
					.on('click', '.lp-modal-search .lp-add-item', this.addItemsToSection)
					.on('click', '.lp-modal-search .lp-add-new-item', this.addNewItem);


				$(window).scroll(function(){
					return;
					var $holder = $('#course_tabs_placeholder'),
						$tabs = $('#course_tabs'),
						top = $holder.offset().top;
					if( $(window).scrollTop() > top ){
						$tabs.css('width', $tabs.width()).addClass('fixed');
					}else{
						$tabs.css('width', '').removeClass('fixed');
					}
				});
			},
			toggleButtonBulkActions: function(e){
				var $checkbox = $(e.target),
					$all = $checkbox.closest('.curriculum-section-items').find('.item-checkbox input'),
					len;
				(len = $all.filter(function(){return this.checked}).length)
					? (
						$checkbox.closest('.curriculum-section-content')
							.find('.item-bulk-actions button')
							.removeAttr('disabled')
							.map(function(){
								var $b = $(this);
								$b.attr('data-action') == 'cancel' ? $b.show() : $b.html($b.attr('data-title') + ' (+'+ len +')')
							})
					)
					: $checkbox.closest('.curriculum-section-content')
						.find('.item-bulk-actions button')
						.attr('disabled', 'disabled')
						.map(function(){
							var $b = $(this);
							$b.attr('data-action') == 'cancel' ? $b.hide() : $b.html($b.attr('data-title'))
						});
				$checkbox.closest('.lp-section-item').toggleClass('remove', e.target.checked)
			},
			sectionBulkActions: function(e){
				var $button = $(e.target),
					$all = $button.closest('.item-bulk-actions').siblings('.curriculum-section-items').find('.lp-section-item'),
					action = $button.attr('data-action');
				switch (action){
					case 'delete':
					case 'delete-forever':
						var $items = $all.filter(function(){return $(this).find('.item-checkbox input').is(':checked')});
						this.removeItem($items, action == 'delete-forever', function(){
							$button.closest('.item-bulk-actions').find('button').attr('disabled', 'disabled').map(function(){
								var $b = $(this).html($(this).attr('data-title'));
								$b.attr('data-action') == 'cancel' && $b.hide();
							});
						});
						break;
					case 'cancel':
						$all.filter(function(){ return $(this).find('.item-checkbox input').removeAttr('checked');})
							.first()
							.find('.item-checkbox input')
							.trigger('change');
				}
			},
			toggleItemType: function(e){
				var $item = $(e.target).closest('.lp-section-item'),
					from = $item.attr('data-type'),
					to = null;
				if( $item.attr('data-item_id') ) {
					return;
				}
				if( $item.hasClass('lp-item-lp_lesson') ){
					to = 'lp_quiz';
					$item
						.removeClass('lp-item-lp_lesson')
						.addClass('lp-item-lp_quiz')
						.attr('data-type', to)
						.find('.lp-item-type').val(to);
				}else{
					to = 'lp_lesson';
					$item
						.removeClass('lp-item-lp_quiz')
						.addClass('lp-item-lp_lesson')
						.attr('data-type', to)
						.find('.lp-item-type', to);
				}
				LearnPress.Hook.doAction( 'learn_press_change_section_item_type', from, to );
			},
			getPrevInput: function($input){
				var $inputs = this.$('input.no-submit:visible'),
					position = $inputs.index($input);
				$prev = position == 0 ? $inputs.eq($inputs.length - 1) : $inputs.eq(position-1);
				return $prev;
			},
			getNextInput: function($input){
				var $inputs = this.$('input.no-submit:visible'),
					position = $inputs.index($input);
				$next = position >= $inputs.length - 1 ? $inputs.eq(0) : $inputs.eq(position+1);
				return $next;
			},
			preventSubmit: function(e){
				var $input = $(e.target);
				if( $input.hasClass('no-submit') ){
					if( ($input.val()+'').length >= 2 ){
						$input.closest('.lp-item-empty').removeClass('lp-item-empty');
						$input.closest('.lp-empty-section').removeClass('lp-empty-section');
					}else{
						$input.closest('.lp-item-empty').addClass('lp-item-empty');
						$input.closest('.lp-empty-section').addClass('lp-empty-section');
					}
					if (e.keyCode == 13) {
						return false;
					}
				}
			},
			_addNewItem: function(e){
				e.preventDefault();
				var that = this,
					$target = $(e.target),
					$section = $target.closest('.curriculum-section'),
					$input = $section.find('input[name="lp-new-item-name"]'),
					type = null;
				if($target.is('a')){
					type = $target.attr('data-type');
					$target = $target.closest('.lp-button-add-item');
				}else{
					if(!$target.is('.lp-button-add-item')){
						$target = $target.closest('.lp-button-add-item');
					}
					type = $target.find('ul > li > a:first').attr('data-type');
				}
				if($target.hasClass('disabled')){
					return;
				}
				if( ($input.val()+'').length == 0 ){
					alert('Please enter item name');
					$input.focus();
					return;
				}
				$.ajax({
					url: LearnPress_Settings.ajax,
					data: {
						action: 'learnpress_add_new_item',
						name: $input.val(),
						type: type
					},
					type: 'post',
					dataType: 'html',
					success: function(response){
						var json = LearnPress.parseJSON(response);
						if(json.post && json.post.ID) {
							$item = that.createItem({
								id: json.post.ID,
								type: json.post.post_type,
								text: json.post.post_title,
								edit_link: json.post.edit_link.replace('&amp;', '&')
							});
							if( $item ) {
								that.addItemToSection( $item, $section );
							}
							$item.removeClass('lp-item-empty');
							$input.val('').focus().trigger('change');
						}
					}
				});
			},
			onEnterInput: function(e){
				var $input = $(e.target),
					$item = $input.closest('.lp-section-item'),
					$section = $item.length ? $item.closest('.curriculum-section') : $input.closest('.curriculum-section'),
					value = $input.val(),
					textLen = value.length,
					type = $input.data('field');
				if($input.attr('name') == 'lp-new-item-name'){
					LearnPress.log(textLen)
					if( textLen > 0 ){
						$input.siblings('.lp-button-add-item').removeClass('disabled');
					}else{
						$input.siblings('.lp-button-add-item').addClass('disabled');
					}
				}
				switch (e.keyCode){
					case 13:
						if($input.attr('name') == 'lp-new-item-name'){
							$input.siblings('.lp-button-add-item').trigger('click')
							return;
						}
					case 40:
						var $next = this.getNextInput($input);
						$next.focus();
						break;
					case 38:
						var $prev = this.getPrevInput($input);
						$prev.focus();
						break;
					case 8:
					case 46:
						if( type == 'section-name' ) {
							if (textLen == 0 && $section.siblings().length) {
								if ($input.attr('empty-value')) {
									var $prev = this.getPrevInput($input);
									$prev.focus();
									$section.remove();
								} else {
									$input.attr('empty-value', 1);
								}
							} else {
								$input.removeAttr('empty-value');
							}
						}else if( type == 'item-name' ) {
							if (textLen == 0 && $item.siblings().length) {
								if ($input.attr('empty-value')) {
									var $prev = this.getPrevInput($input);
									$prev.focus();
									$item.remove();
								} else {
									$input.attr('empty-value', 1);
								}
							} else {
								$input.removeAttr('empty-value');
							}
						}
						break;
					default:
						if( type == 'section-name') {
							var $nextSection = $section.next();

							if ($nextSection.length == 0 && textLen >= 3 ) {
								var $emptySection = this.createSection();

							}
						}else if(type == 'item-name'){
							var $nextItem = $item.next();
							if ($nextItem.length == 0 && textLen>= 3) {
								var $emptyItem = this.createItem({type: 'lp_lesson'});
								var $last = $section.find('.curriculum-section-items .lp-section-item:last');
								$emptyItem.insertAfter($last);
							}
						}

				}

			},
			getEmptySection: function(){
				if( !this.$emptySection ){
					this.createSection();
				}
				return this.$emptySection;
			},
			createSection: function(){
				var tmpl = wp.template('curriculum-section');
				this.$emptySection = $(tmpl({}));
				this.$('.curriculum-sections').append(this.$emptySection);
				return this.$emptySection;
			},
			createItem: function(args, $section){
				var tmpl = wp.template('section-item'),
					$item = $(tmpl(args || {}));
				$item = LearnPress.Hook.applyFilters( 'learn_press_create_new_item', $item, $section );
				return $item;
			},
			needCreateNewSection: function(){

			},
			toggleSection: function(e){
				var $button = $(e.target),
					$section = $button.closest('.lp-curriculum-section');
				$section.find('.lp-curriculum-section-content').stop().slideToggle(function(){
					if( $(this).is(':visible') ){
						$(this).parent().addClass('open')
					}else{
						$(this).parent().removeClass('open')
					}
				});
			},
			toggleSections: function(e){
				e.preventDefault();
				var $target = $(e.target);
				if($target.attr('data-action') == 'expand' ){
					this.$('.curriculum-section:not(.lp-empty-section) .lp-curriculum-section-content').slideDown();
				}else{
					this.$('.curriculum-section:not(.lp-empty-section) .lp-curriculum-section-content').slideUp();
				}
			},
			getSelectedItems: function(){
				return this.$('.lp-section-item').map(function(){return parseInt($(this).attr('data-item_id'))}).get();
			},
			showFormItems: function( type, action, $button ){
				if( type == 'lp_quiz' ) {
					$form = $('#lp-modal-search-quiz');
					if ($form.length == 0) {
						$form = $(wp.template('lp-modal-search-quiz')());
					}
				}else{
					$form = $('#lp-modal-search-lesson');
					if ($form.length == 0) {
						$form = $(wp.template('lp-modal-search-lesson')());
					}
				}

				$form
					.data('item_type', type)
					.data('section', $button.closest('.curriculum-section')).show();
				var selectedItems = this.getSelectedItems(),
					unselectedItems = $form.find('li').filter(function(){
						var id = parseInt($(this).data('id')),
							selected = false;
						if( id && $.inArray( id, selectedItems ) == -1 ){
							$(this).removeClass('selected hide-if-js');
							selected = false;
						}else{
							$(this).addClass('selected hide-if-js');
							selected = true;
						}
						$(this).find('input[type="checkbox"]').removeAttr('checked');
						return !selected;
					});
				LearnPress.MessageBox.show($form);
				$form.find('[name="lp-item-name"]').focus();
				$form.find('button.lp-add-item').html($form.find('button.lp-add-item').attr('data-text'));
				if( unselectedItems.length ){
					$form.find('.lp-search-no-results').hide();
				}else{
					$form.find('.lp-search-no-results').show();
				}
				LearnPress.Hook.doAction( 'learn_press_show_form_items', $form, action, $button, this );
			},
			sectionActionHandler: function(e){
				var that = this,
					$button = $(e.target),
					action = $button.data('action'),
					type = $button.data('type'),
					$form = null;
				switch (action){
					case 'add-quiz':
					case 'add-lesson':
						this.showFormItems( type, action, $button );
						break;
					default:
						LearnPress.Hook.doAction( 'learn_press_section_button_click', $button, action, this );
				}
			},
			searchItem: function(e){
				var $input = $(e.target),
					$form = $input.closest('.lp-modal-search'),
					text = $input.val().replace(/\\q\?[\s]*/ig, ''),
					$lis = $form.find('li:not(.lp-search-no-results):not(.selected)').addClass('hide-if-js'),
					reg = new RegExp($.grep(text.split(/[\s]+/),function(a){return a.length}).join('|'), "ig"),
					found = 0;
				LearnPress.log(text)
				//if( text.length ) {
					found = $lis.filter(function () {
						var $el = $(this),
							itemText = $el.data('text')+'',
							ret = itemText.search(reg) >= 0;
						if(ret){
							$el.find('.lp-item-text').html( itemText.replace(reg, "<i class=\"lp-highlight-color\">\$&</i>" ) );
						}else{
							$el.find('.lp-item-text').html( itemText );
						}
						return ret;
					}).removeClass('hide-if-js').length;
				/*}else{
					found = $lis.removeClass('hide-if-js');
					found.find('.lp-highlight-color').remove();
					found = found.length
				}*/
				if( ! found ) {
					$form.find('.lp-search-no-results').removeClass('hide-if-js');
				}else{
					$form.find('.lp-search-no-results').addClass('hide-if-js');
				}
			},
			addItemsToSection: function(e){
				var that = this,
					$form = $(e.target).closest('.lp-modal-search'),
					selected = $form.find('li:visible input:checked'),
					$section = $form.data('section');
				selected.each(function(){
					var $li = $(this).closest('li').addClass('selected'),
						args = $li.dataToJSON(),
						$item = that.createItem( args, $section );
					if( $item ) {
						that.addItemToSection( $item, $section );
					}
				});
				$form.hide().appendTo($(document.body));
				LearnPress.MessageBox.hide();
			},
			addItemToSection: function( $item, $section ){
				var $last = $section.find('.curriculum-section-items .lp-section-item:last');
				$item.insertBefore($last);
				$item.removeClass('lp-item-empty');
				this.model.addItem(parseInt($item.attr('data-id')));
				LearnPress.Hook.doAction( 'learn_press_add_item_to_section', $item, $section );
			},
			addNewItem: function(e){
				var $form = $(e.target).closest('.lp-modal-search');
				$.ajax({
					url: LearnPress_Settings.ajax,
					data: {
						action: 'learnpress_quick_add_item',
						name: $form.find('input[name="lp-item-name"]').val(),
						type: $form.data('item_type') || 'lp_lesson'
					},
					type: 'post',
					dataType: 'html',
					success: function(response){
						var json = LearnPress.parseJSON(response);
						if(json.html){
							var $item = $(json.html)
							$form.find('ul').append($item);
							$item.find('input[type="checkbox"]').attr('checked', true).trigger('change');
						}
					}
				});
			},
			toggleAddItemButtonState: function(e){
				var $form = $(e.target).closest('.lp-modal-search'),
					selected = $form.find('li input:checked'),
					$button = $form.find('.lp-add-item');
				if( selected.length ){
					$button.removeAttr('disabled').html($button.attr('data-text')+' (+'+selected.length+')');
				}else{
					$button.attr('disabled', true).html($button.attr('data-text'));
				}
			},
			onSave: function( evt ){
				/*return;
				var $title = $('#title'),
					$curriculum = $('.lp-curriculum-section:not(.lp-section-empty)'),
					is_error = false;
				if (0 == $title.val().length) {
					alert( lp_course_params.notice_empty_title );
					$title.focus();
					is_error = true;
				} else if (0 == $curriculum.length) {
					alert( lp_course_params.notice_empty_section );
					$('.lp-curriculum-section .lp-section-name').focus();
					is_error = true;
				} else {
					/*$curriculum.each(function () {
					 var $section = $('.lpr-section-name', this);
					 if (0 == $section.val().length) {
					 alert( lp_course_params.notice_empty_section_name );
					 $section.focus();
					 is_error = true;
					 return false;
					 }
					 });
				}
				if( $( 'input[name="_lpr_course_payment"]:checked').val() == 'not_free' && $('input[name="_lpr_course_price"]').val() <= 0 ){
					alert( lp_course_params.notice_empty_price );
					is_error = true;
					$('input[name="_lpr_course_price"]').focus();
				}
				if (true == is_error) {
					evt.preventDefault();
					return false;
				}
				*/
				return this._prepareSections();
				//return false
			},
			_prepareSections: function(){
				var $sections = this.$form.find('.curriculum-section');
				$sections.each(function( i, n ){
					var $section = $(this),
						$items = $section.find('.lp-section-item'),
						$inputs = $('input[name*="__SECTION__"]', $section),
						section_id = parseInt($section.attr('data-id'));
					$inputs.each( function(){
						var $input = $(this),
							name = $input.attr('name');
						name = name.replace(/__SECTION__/, section_id ? section_id : 'section-'+i);
						$input.attr('name', name);
					});
					$items.each(function(j, l){
						$(this).find('input[name*="__ITEM__"]').each( function(){
							var $input = $(this),
								name = $input.attr('name');
							name = name.replace(/__ITEM__/, 'item-'+j);
							$input.attr('name', name);
						});
					});
				});
				if(this.removeItemIds){
					this.$form.append( '<input type="hidden" name="_lp_remove_item_ids" value="' + this.removeItemIds.join(',') + '" />');
				}
			},
			render: function(){

			},
			inputKeyPressEvent: function(e){
				if(this.isShowing && e.keyCode==13){
					return false;
				}
			},
			inputKeyDownEvent: function(e){
				var $input = $(e.target);
				$input.attr('lastCode', e.keyCode);
				$input.attr('caret', $input.caret());
			},
			processKeyEvents: function(e){
				var $target = $(e.target),
					$section = $target.closest('.lp-curriculum-section'),
					field = $target.attr('data-field'),
					lastCode = $target.data('lastCode'),
					keyCode = e.keyCode,
					text = $target.val(),
					caretPos = $target.caret(),
					caretLen = text.length,
					that = this;
				if( field == 'item-name' ){
					var $item = $target.closest('.lp-section-item');
					if(text.match(/\\q\?/i) || this.isShowing == 'searchQuizForm') {
						this.searchQuizForm($item);
					}
					if(text.match(/\\l\?/i)){
						this.searchLessonForm($item);
					}
					if(e.altKey) {
						if (keyCode == 81) {
							$target.closest('.lp-section-item').find('.handle.dashicons').removeClass('dashicons-media-document').addClass('dashicons-format-status');
							$target.siblings('.lp-item-type').attr('value', 'lp_quiz');
						} else if (keyCode == 76) {
							$target.closest('.lp-section-item').find('.handle.dashicons').removeClass('dashicons-format-status').addClass('dashicons-media-document');
							$target.siblings('.lp-item-type').attr('value', 'lp_lesson');
						}
					}
				}
				var xxx = true;
				if( this.isShowing ) {
					xxx = this[this.isShowing + 'KeyEvents'] && this[this.isShowing + 'KeyEvents'].call(this, e);
				}
				if( xxx === false ) return;
				//[33 = page up, 34 = page down, 35 = end, 36 = home, 37 = left, 38 = up, 39 = right, 40 = down, 8 = backspace, enter = 13, 46 = del]
				switch (keyCode){
					case 8: // backspace
					case 46:
						if( text.length == 0 && $target.data('keyRepeat') == 2 ){
							if( field == 'section-name' ){

							}else if( field == 'item-name' ){
								var $item = $target.closest('.lp-section-item').css('visibility', 'hidden');
								var $inputs = this.$('.lp-item-name:visible'),
									pos = $inputs.index($target);
								if( $inputs.length == 1 ){
									$inputs.addClass('lp-item-empty');
									break;
								}
								if( keyCode == 8 ) {
									pos > 0 ? $inputs.eq(pos - 1).focus().caret($inputs.eq(pos - 1).val().length) : '';
								}else{
									pos < $inputs.length - 1 ? $inputs.eq(pos+1).focus().caret(0) : '';
								}
								$item.remove();
							}
						}
						break;
					case 13: // enter

						break;
					case 33: // page up
					case 34: // page down
					case 35: // end
					case 36: // home
					case 37: // left
					case 39: // right
						break;
					case 38: // up
					case 40: // down
						//if( this.isShowing ){
						this[this.isShowing+'KeyEvents'] && this[this.isShowing+'KeyEvents'].call(this, e);
						//}else {
						var isDown = keyCode == 40;
						var $inputs = this.$('.lp-section-name:visible, .lp-item-name:visible'),
							pos = $inputs.index($target);
						if (isDown) {
							pos == $inputs.length - 1 ? $inputs.eq(0).focus() : $inputs.eq(pos + 1).focus();
						} else {
							pos == 0 ? $inputs.eq($inputs.length - 1).focus() : $inputs.eq(pos - 1).focus();
						}
						//}
						break;
					default:
						if( $target.val().length > 0 ){
							if( field == 'section-name' ){
								$section.removeClass('lp-section-empty');
								that.appendSection($section);
							}else if( field == 'item-name' ){
								var $item = $target.closest('.lp-section-item').removeClass('lp-item-empty');
								that.appendSectionItem($item);
							}
						}
				}
				if( lastCode == keyCode && text.length == 0 ){
					var keyRepeat = $target.data('keyRepeat');
					if( ! keyRepeat ){ keyCode = 1}
					$target.data('keyRepeat', keyRepeat+1);
				}else{
					$target.data('keyRepeat', 1);
				}

				$target.data('lastCode', keyCode);

			},
			appendSection: function($section){
				var that = this,
					$sections = this.$('.lp-curriculum-section'),
					$last = $sections.last();
				if(!$last.hasClass('lp-section-empty')){
					this._createSection().insertAfter($last);
				}
			},
			appendSectionItem: function($item, $section){
				if( ! $section ) $section = $item.closest('.lp-curriculum-section');
				var that = this,
					$items = $section.find('.lp-section-item'),
					$last = $items.last();
				if(!$last.hasClass('lp-item-empty')){
					this._createItem().insertAfter($last);
				}
			},
			searchQuizForm: function($item){
				if( this.isShowing == 'searchQuizForm' && this.$modalQuizzes ){
					var $input = $item.find('.lp-item-name'),
						text = $input.val().replace(/\\q\?[\s]*/ig, ''),
						$lis = this.$modalQuizzes.find('li:not(.lp-search-no-results):not(.selected)').addClass('hide-if-js'),
						reg = new RegExp($.grep(text.split(/[\s]+/),function(a){return a.length}).join('|'), "ig"),
						found = 0;
					if( text.length ) {
						found = $lis.filter(function () {
							var $el = $(this),
								itemText = $el.data('text'),
								ret = itemText.search(reg) >= 0;
							if(ret){
								$el.html( itemText.replace(reg, "<i class=\"lp-highlight-color\">\$&</i>" ) );
							}else{
								$el.html( itemText );
							}
							return ret;
						}).removeClass('hide-if-js').length;
					}else{
						found = $lis.removeClass('hide-if-js').length;
					}
					if( ! found ) {
						this.$modalQuizzes.find('.lp-search-no-results').removeClass('hide-if-js');
					}else{
						this.$modalQuizzes.find('.lp-search-no-results').addClass('hide-if-js');
					}
					return;
				}
				if(!this.$modalQuizzes){
					this.$modalQuizzes = $(wp.template('lp-modal-search-quiz')({}))
				}
				var $input = $item.find('.lp-item-name'),
					position = $input.offset();

				this.$modalQuizzes.insertAfter($input).css({
					position: 'absolute',
					//top: position.top + $input.outerHeight(),
					left: $input.position().left,
					width: $input.outerWidth() - 2
				}).show();
				if( this.$modalQuizzes.find('li:not(.lp-search-no-results):not(.selected)').length == 0 ){
					this.$modalQuizzes.find('li.lp-search-no-results').show();
				}
				this.isShowing = 'searchQuizForm';
			},
			searchQuizFormKeyEvents: function(e){
				return;
				var $items = this.$modalQuizzes.find('li:visible:not(.lp-search-no-results)'),
					$activeItem = $items.filter('.highlighting'),
					$next = false;
				switch(e.keyCode){
					case 38: // up
						if($activeItem.length){
							$next = $activeItem.prev();
						}
						if(!$next.length) {
							$next = $items.last();
						}
						//.removeClass('highlighting');
						$next.addClass('highlighting').siblings().removeClass('highlighting');
						return false;
						break;
					case 40: // down
						if($activeItem.length){
							$next = $activeItem.next();
						}
						if(!$next.length) {
							$next = $items.first();
						}
						//$activeItem.removeClass('highlighting');
						$next.addClass('highlighting').siblings().removeClass('highlighting');
						return false;
						break;
					case 13:
					case 27:
						this.isShowing = '';
						if(e.keyCode == 13) {
							var $input = $(e.target),
								$item = $input.closest('.lp-section-item');
							$input.val($activeItem.data('text'));
							var id = $activeItem.attr('data-id'),
								type = $activeItem.attr('data-type');
							$item.removeClass('.lp-item-lp_lesson lp-item-empty lp-item-new').addClass('lp-item-'+type).attr({
								'data-type': type,
								'data-id': id
							})
						}else{
							$(e.target).val($(e.target).val().replace(/\\q\?[\s]*/ig, ''));
						}
						this.$modalQuizzes.hide();
						e.preventDefault();
						return false;
						break;
				}

			},
			searchLessonForm: function(){
				alert('search lesson')
			},
			_getNextSection: function($section, loop){
				var $nextSection = $section.next();
				if( $nextSection.length == 0 && ((typeof loop == 'undefined') || (loop == true))){
					$nextSection = $section.parent().children().first();
				}
				return $nextSection;
			},
			_getPrevSection: function($section, loop){
				var $prevSection = $section.prev();
				if( $prevSection.length == 0 && ((typeof loop == 'undefined') || (loop == true))){
					$prevSection = $section.parent().children().last();
				}
				return $prevSection;
			},
			_createSection: function(){
				var sectionTemplate = wp.template('curriculum-section');
				return $(sectionTemplate({}));
			},
			_createItem: function(){
				var itemTemplate = wp.template('section-item');
				return $(itemTemplate({}));
			},
			_removeItem: function(e){
				e.preventDefault();
				var $item = $(e.target).closest('.lp-section-item');
				this.removeItem($item);
			},
			removeItem: function($items, b, callback){
				if( $items.length == 0 ) return;
				var that = this,
					itemNames = $items.map(function(){return $(this).find('.lp-item-name').val()}).get().join('</p><p>+&nbsp;');
				LearnPress.MessageBox.show( meta_box_course_localize.notice_remove_section_item+'<h4><p>+&nbsp;'+itemNames+'</p></h4>', {
					data: {
						items: $items,
						self: this
					},
					buttons: 'yesNo',
					events:{
						onNo: function(instance){
							$items
								.each(function(){
									$(this).removeClass('remove').find('.item-checkbox input').prop('checked', false)
								})
								.closest('.curriculum-section')
								.find('.item-bulk-actions button')
								.attr('disabled', 'disabled')
								.map(function(){
									var $b = $(this);
									$b.attr('data-action') == 'cancel' ? $b.hide() : $b.html($b.attr('data-title'))
								});
						},
						onYes: function(instance){
							var ids = [];
							instance.data.items && instance.data.items.each(function(){
								var $item = $(this),
									id = parseInt( $item.attr('data-section_item_id') ),
									type = $item.attr('data-type');
								$item.remove();
								if(id) {
									instance.data.self.model.removeItem(id);
									ids.push(id);
								}
							});
							if( b ) {
								that.removeItemDB(ids);
							}
							$.isFunction(callback) && callback.call();
						}
					}
				})
			},
			removeItemDB: function(id){
				$.ajax({
					url: LearnPress_Settings.ajax,
					data: {
						action: 'learnpress_remove_post_items',
						id: id
					},
					success: function(response){
						LearnPress.log(response)
					}
				});
			},
			findItemsById: function(id){
				if(!$.isArray(id)){
					id = [parseInt(id)];
				}else{
					id = id.map(function(n){return parseInt(n)});
				}
				return this.$('.lp-section-item').filter(function(){return $.inArray( parseInt($(this).attr('data-id')), id) != -1 });
			}
		});
		var model = new LP_Curriculum_Model(LP_Curriculum_Settings),
			view = new LP_Curriculum_View(model);

		LearnPress.$LP_Curriculum_Model = model;
		LearnPress.$LP_Curriculum_View = view;
	});

	function updateHiddenCurriculum(hidden){
		if( hidden == undefined ) {
			hidden = [];
			var len = $('.curriculum-section-content').each(function () {
				if ($(this).is(':hidden')) {
					hidden.push($(this).parent().attr('data-id'));
				}
			}).length;
			if( hidden.length == len ){
				$('.lp-section-actions a[data-action="collapse"]')
					.hide()
					.siblings('a[data-action="expand"]')
					.show();
			}
		}
		if( hidden.length == 0 ){
			$('.lp-section-actions a[data-action="collapse"]')
				.show()
				.siblings('a[data-action="expand"]')
				.hide();
		}

		$.ajax({
			url: LearnPress_Settings.ajax,
			data: {
				action: 'learnpress_update_curriculum_section_state',
				course_id: $('#post_ID').val(),
				hidden: hidden
			},
			success: function(){

			}
		});
		return hidden;
	}

	function _removeSectionHandler(){

	}

	function _toggleSectionsHandler(e){
		e.preventDefault();
		var action = $(this).attr('data-action');
		switch (action){
			case 'expand':
				var $items = $('.curriculum-section-content'),
					len = $items.length, i = 0;
				$(this)
					.hide()
					.siblings('a[data-action="collapse"]')
					.show();
				$items
					.removeClass('is-hidden')
					.slideDown(function(){
						if(++i == len){
							updateHiddenCurriculum([]);
						}
					});
				$items.find('a[data-action="collapse"]').show();
				$items.find('a[data-action="expand"]').hide();
				break;
			case 'collapse':
				var $items = $('.curriculum-section-content'),
					len = $items.length, i = 0,
					hidden = [];
				$(this)
					.hide()
					.siblings('a[data-action="expand"]')
					.show();
				$items
					.addClass('is-hidden')
					.slideUp(function(){
						hidden.push($(this).parent().attr('data-id'));
						if(++i == len){
							updateHiddenCurriculum(hidden);
						}
					});
				$items.find('a[data-action="collapse"]').hide();
				$items.find('a[data-action="expand"]').show();
				break;
		}
	}

	function _sectionActionHandler(e){
		var action = $(this).attr('data-action');
		switch (action){
			case 'expand':
				$(this)
					.hide()
					.siblings('a[data-action="collapse"]')
					.show()
					.closest('.curriculum-section')
					.removeClass('is-hidden')
					.find('.curriculum-section-content').slideDown(function(){
						if( updateHiddenCurriculum().length == 0 ){

						}
					});
				break;
			case 'collapse':
				$(this)
					.hide()
					.siblings('a[data-action="expand"]')
					.show()
					.closest('.curriculum-section')
					.addClass('is-hidden')
					.find('.curriculum-section-content').slideUp(function(){
						updateHiddenCurriculum();
					});
				break;
			case 'remove':
				LearnPress.MessageBox.show( 'Do you want to remove this section?', {
					buttons: 'yesNo',
					data: $(this).closest('.curriculum-section'),
					events: {
						onYes: function(args){
							var $question = $(args.data);
							$question.remove();
						}
					}
				})
				break;
			case 'edit':
				LearnPress.MessageBox.show('<iframe src="'+$(this).attr('href')+'" />');

		}
		if( action ){
			e.preventDefault();
		}
	}

	function _toggleEditorHandler(e){
		if(e.type == '_click'){
			if($(this).data('hidden') == 'yes' ){
				$('#postdivrich').addClass('hide-if-js');
			}
			$('#postdivrich').css('visibility', 'visible');
		}else {
			var is_hidden = 'yes';
			if( !$('#postdivrich').toggleClass('hide-if-js').hasClass('hide-if-js') ){
				$(window).trigger('scroll');
				is_hidden = '';
			};
			$.ajax({
				url: LearnPress_Settings.ajax,
				type: 'post',
				data: {
					action: 'learnpress_update_editor_hidden',
					course_id: $('#post_ID').val(),
					is_hidden: is_hidden
				},
				success: function(){

				}
			});
		}
	}
	function _makeListSortable(){
		$('.curriculum-sections')
			.sortable({
				items: '.curriculum-section:not(.lp-empty-section)',
				handle: '.lp-section-actions a[data-action="move"]',
				axis: 'y'
			});

		$('.curriculum-section-items')
			.sortable({
				items: '.lp-section-item:not(.lp-item-empty)',
				handle: '.item-checkbox',
				axis: 'y',
				connectWith: '.curriculum-section-items',
				stop: function(e, ui){
					var $emptyItem = ui.item.parent().find('.lp-item-empty:last');
					LearnPress.log('empty:')
					LearnPress.log($emptyItem.get(0))
					LearnPress.log('next:')
					LearnPress.log($emptyItem.next().get(0))
					if ($emptyItem.next().is(ui.item.get(0))) {
						$emptyItem.insertAfter(ui.item);
					}
				}
			});
	}
	function _ready(){
		$('#learn-press-button-toggle-editor').on('click _click', _toggleEditorHandler).trigger('_click');
		_makeListSortable();
	}
	$(document)
		.ready(_ready)
		.on('click', '.items-toggle a', _toggleSectionsHandler)
		.on('click', '.lp-section-actions a', _sectionActionHandler);

})(jQuery);
