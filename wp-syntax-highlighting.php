<?php
/*
Plugin Name: WP Syntax Highlighting
Plugin URI: http://buzheng.org/ssh/wp-plugin/
Description: WP Syntax Highlighting is a simple wordpress plugin to help you hightlight code syntax on your blog.
Author: buzheng (admin@buzheng.org)
Version: 1.0
Author URI: http://buzheng.org/
*/

// Hook for action
add_action('wp_head','ssh_add_js_and_style');
add_action('wp_footer','ssh_add_js_block');
// Hook for adding admin menus
add_action('admin_menu', 'ssh_setting_menu');
// Hook for addming plugin action links
add_filter('plugin_action_links', 'ssh_setting_link_action', 10, 2);
// Load Language files
load_plugin_textdomain('ssh', str_replace( ABSPATH, '', dirname(__FILE__) ) . '/languages');


// action function for above hook
function ssh_setting_menu() {
	// Add a new submenu under Settings:
	add_options_page('WP Syntax Highlighting', 
			__('WP Syntax Highlighting', 'ssh'),
			'manage_options', 'wp-syntax-highlighting',
			'ssh_setting_page');
}

function ssh_setting_link_action($action_links, $plugin_file, $plugin_data, $context){
	static $this_plugin;
	
	if( !$this_plugin ) {
		$this_plugin = plugin_basename(__FILE__);
	}

	if( $plugin_file == $this_plugin ){
		$settings_link = '<a href="options-general.php?page=wp-syntax-highlighting">' . esc_attr_e('Settings') . '</a>';
		$action_links = array_merge( array($settings_link), $action_links);
	}
	return $action_links;
}

function ssh_add_js_and_style() {
	$sshDirPath = get_option('siteurl') .'/wp-content/plugins/' . basename(dirname(__FILE__)) .'/';

	echo '<!-- WP Syntax Highlighting -->
<script type="text/javascript" src="' . $sshDirPath . 'ssh/ssh.js"></script>
<link type="text/css" rel="stylesheet" href="' . $sshDirPath . 'ssh/ssh.css"/>
<!-- WP Syntax Highlighting -->
';
}

function ssh_add_js_block() {
	
	$config = ssh_load_setting();
	
	
	echo '<script type="text/javascript">
(new ssh.Beautifier({
	tab:' . $config['tab'] . ',
	linenum:' . ($config['linenum'] ? 'true' : 'false') . ',
	zebra: ' . ($config['zebra'] ? 'true' : 'false') . '})).beautify();
</script>';
}

function ssh_setting_page() {	
	$message = '';	
	// save options first, if necessary.
	if (isset($_POST['ssh_save_setting'])) {
		ssh_save_setting();
		$message = '<div class="updated settings-error" id="setting-error-settings_updated"><p><strong>' . esc_attr_e('Settings saved.') . '</strong></p></div>';
	}
	
	// load options
	$ssh_config = ssh_load_setting();
	
	$tags = $ssh_config['tags'];
	$tab = $ssh_config['tab'];
	$linenum = $ssh_config['linenum'];
	$zebra = $ssh_config['zebra'];	
?>
	
<div class="wrap">
<div id="icon-options-general" class="icon32"><br></div>
<h2><?php _e('WP Syntax Highlighting Configuration', 'ssh'); ?></h2>
<?php echo $message; ?>
<!--p>WP Syntax Highlighting是一个语法高亮插件，通过客户端javascript来渲染代码，实现代码的美化：语法高亮、显示行号等。</p-->
<p><?php _e('WP Syntax Highlighting is a simple wordpress plugin to help you hightlight code syntax on your blog. It supports many programming languages.', 'ssh'); ?></p>
<!--p>作者：<a href="http://buzheng.org/">不争（buzheng.org）</a></p-->
<p><?php _e('Author', 'ssh'); ?>：<a href="http://buzheng.org/" href="_blank">不争</a>（<a href="http://buzheng.org/" href="_blank">buzheng.org</a>）</p>
<form action="" method="post">
	<table class="form-table">
		<tr>
			<th><?php _e('Spaces instead of tabs', 'ssh'); ?></th>
			<td><input type="text" name="ssh_tab" value="<?php echo $tab; ?>" size="4" /></td>
		</tr>
		<tr>
			<th><?php _e('Display line numbers?', 'ssh'); ?></th>
			<td>
				<input type="checkbox" name="ssh_linenum" value="true" id="ssh_linenum" <?php echo ($linenum == true ? 'checked="checked"' : ''); ?> />
			</td>
		</tr>
		<tr>
			<th><?php _e('Display zebra stripe?', 'ssh'); ?></th>
			<td>
				<input type="checkbox" name="ssh_zebra" value="true" id="ssh_zebra"  <?php echo ($zebra == true ? 'checked="checked"' : ''); ?> />
			</td>
		</tr>
	</table>
	
	<p class="submit">		
		<input type="submit" name="ssh_save_setting" class="button-primary" value="<?php esc_attr_e('Save Changes') ?>" />
	</p>
</form>

</div>
	
<?php
}


function ssh_load_setting() {
	return default_options(get_option('ssh_options'));
}

function ssh_save_setting() {	
	
	@$tab = $_POST['ssh_tab'];
	@$linenum = $_POST['ssh_linenum'];
	@$zebra = $_POST['ssh_zebra'];
	
	$ssh_config = array('tab' => $tab, 'linenum' => $linenum, 'zebra' => $zebra);
	
	$ssh_config = default_options($ssh_config);	
	update_option('ssh_options', $ssh_config);	
}

function default_options($ssh_config) {	
	if (!isset($ssh_config['tab']) || $ssh_config['tab'] == '') {
		$ssh_config['tab'] = '4';
	}
	
	$tab = intval($tab);
	if ($tal < 0) {
		$ssh_config['tab'] = '4';
	}

	if (!isset($ssh_config['linenum']) || $ssh_config['linenum'] == '') {
		$ssh_config['linenum'] = false;
	} else if ($ssh_config['linenum'] != false){
		$ssh_config['linenum'] = true;
	}
	
	if (!isset($ssh_config['zebra']) || $ssh_config['zebra'] == '') {
		$ssh_config['zebra'] = false;
	} else if ($ssh_config['zebra'] != false) {
		$ssh_config['zebra'] = true;
	}
	
	return $ssh_config;
}

?>