<?php

// Prevent loading this file directly
defined( 'ABSPATH' ) || exit;
/**
 * Class RWMB_Quiz_Questions_Field
 *
 * @author  ThimPress
 * @package LearnPress/Classes
 * @version 1.0
 * @extend  RWMB_Field
 */
if ( !class_exists( 'RWMB_Quiz_Questions_Field' ) ) {
	class RWMB_Quiz_Questions_Field extends RWMB_Field {
		function __construct() {

		}

		static function admin_enqueue_scripts() {
			/*$q = new LP_Question();
			$q->admin_script();*/
			LP_Admin_Assets::enqueue_style( 'select2', RWMB_CSS_URL . 'select2/select2.css' );
			LP_Admin_Assets::enqueue_script( 'select2', RWMB_JS_URL . 'select2/select2.min.js' );
			LP_Admin_Assets::enqueue_script( 'lpr-quiz-question', LearnPress()->plugin_url( 'inc/admin/meta-boxes/js/quiz-question.js' ) );

		}

		static function add_actions() {
			// Do same actions as file field
			parent::add_actions();

			add_action( 'wp_ajax_lpr_quiz_question_add', array( __CLASS__, 'quiz_question_add' ) );
			add_action( 'wp_ajax_lpr_quiz_question_remove', array( __CLASS__, 'quiz_question_remove' ) );
		}

		static function quiz_question_remove() {
			$question_id = isset( $_REQUEST['question_id'] ) ? $_REQUEST['question_id'] : null;
			$quiz_id     = isset( $_REQUEST['quiz_id'] ) ? $_REQUEST['quiz_id'] : null;

			$questions = get_post_meta( $quiz_id, '_lpr_quiz_questions', true );
			if ( isset( $questions[$question_id] ) ) {
				unset( $questions[$question_id] );
				update_post_meta( $quiz_id, '_lpr_quiz_questions', $questions );
			}
			die();
		}

		static function quiz_question_add() {
			$type        = isset( $_REQUEST['type'] ) ? $_REQUEST['type'] : null;
			$text        = isset( $_REQUEST['text'] ) ? $_REQUEST['text'] : null;
			$question_id = isset( $_REQUEST['question_id'] ) ? $_REQUEST['question_id'] : null;
			$question    = LP_Question::instance( $question_id ? $question_id : $type );
			$json        = array(
				'success' => false
			);
			if ( $question ) {
				if ( !$question_id ) {
					$question->set( 'post_title', $text ? $text : 'Your question text here' );
					$question->set( 'post_type', LP()->question_post_type );
					$question->set( 'post_status', 'publish' );
				}


				if ( ( $question_id = $question->store() ) && isset( $_POST['quiz_id'] ) && ( $quiz_id = $_POST['quiz_id'] ) ) {
					$quiz_questions               = (array) get_post_meta( $quiz_id, '_lpr_quiz_questions', true );
					$quiz_questions[$question_id] = array( 'toggle' => 0 );
					update_post_meta( $quiz_id, '_lpr_quiz_questions', $quiz_questions );
				}
				ob_start();
				$question->admin_interface();
				$json['html']     = ob_get_clean();
				$json['success']  = true;
				$json['question'] = get_post( $question_id );
			} else {
				$json['msg'] = __( 'Can not create a question', 'learn_press' );
			}
			wp_send_json( $json );
			die();
		}

		static function save_quiz_questions( $post_id ) {
			learn_press_debug($_POST);
			die();
			static $has_updated;
			$questions = isset( $_POST[LP()->question_post_type] ) ? $_POST[LP()->question_post_type] : null;
			if ( !$questions ) return;
			$postmeta = array();

			// prevent infinite loop with save_post action
			if ( $has_updated ) return;
			$has_updated = true;

			foreach ( $questions as $question_id => $options ) {
				$question = LP_Question::instance( $question_id );
				if ( $question ) {
					$question_id = $question->save_post_action();
					if ( $question_id ) {
						$postmeta[$question_id] = array( 'toggle' => $options['toggle'] );
						if ( !empty( $options['type'] ) ) {
							$post_data         = get_post_meta( $question_id, '_lpr_question', true );
							$post_data['type'] = $options['type'];
							update_post_meta( $question_id, '_lpr_question', $post_data );
						}
					}
				}
			}

			update_post_meta( $post_id, '_lpr_quiz_questions', $postmeta );
		}

		static function html( $meta, $field ) {
			ob_start();
			$view = learn_press_get_admin_view( 'meta-boxes/quiz/questions.php' );
			include $view;
			return ob_get_clean();
		}

		static function save(){
			global $wpdb, $post;

			$questions = learn_press_get_request( 'learn_press_question' );
			if( $all_questions = LP_Quiz::get_quiz( $post->ID )->get_questions() ){
				$all_questions = array_keys( $all_questions );
			}

			// remove questions if it has removed from $_POST
			if( $all_questions && $questions && ( $remove_ids = array_diff( $all_questions, array_keys( $questions ) ) ) ){
				$query = $wpdb->prepare("
					DELETE
					FROM {$wpdb->learnpress_quiz_questions}
					WHERE quiz_id = %d
					AND question_id IN(" . join(',', $remove_ids ) . ")
				", $post->ID );
				$wpdb->query( $query );
				do_action( 'learn_press_remove_quiz_questions', $remove_ids, $post->ID );
			}
			if( ! $questions ){
				return;
			}
			$titles = learn_press_get_request( 'learn-press-question-name' );

			// update the title of questions and save all data
			foreach( $questions as $id => $data ){
				$question = LP_Question_Factory::get_question($id );
				if( ! empty( $titles[ $id ] ) ){
					$wpdb->update(
						$wpdb->posts,
						array(
							'post_title' => $titles[ $id ]
						),
						array(
							'ID' => $id
						),
						array( '%s' )
					);
				}
				$question->save( $data );
			}

			// if there are new questions then insert into quiz
			if( $new_ids = array_diff( array_keys( $questions ), $all_questions ) ){
				$values = array();
				foreach( $new_ids as $id ){
					$insert_data = apply_filters(
						'learn_press_quiz_question_insert_data',
						array(
							'question_id' => $id,
							'quiz_id'	=> $post->ID,
							'params'	=> ''
						)
					);
					$values[] = $wpdb->prepare( "(%d, %d, %s)", $insert_data['quiz_id'], $insert_data['question_id'], $insert_data['param'] );
				}
				$query = "
					INSERT INTO {$wpdb->learnpress_quiz_questions}(`quiz_id`, `question_id`, `params`)
					VALUES " . join(',', $values) . "
				";
				$wpdb->query( $query );
				do_action( 'learn_press_insert_quiz_questions', $new_ids, $post->ID );
			}
		}
	}

	//add_action( 'save_post', array( 'RWMB_Quiz_Questions_Field', 'save_quiz_questions' ), 1000000 );
}