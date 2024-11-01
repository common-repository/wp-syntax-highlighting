/**
 * SSH - Simple Syntax Highlighting
 * An code Syntax Highlighting tool that is developed by javascript.
 *
 * @author     buzheng (admin@buzheng.org)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL
 * @copyright  (C) 2011 buzheng
 * @version    1.0
 */

/**
 * format string
 * e.g.
 * 'This is a {0} not a {1}.'.format('string', 'num') => This is a string not a num.
 * 'This is a {0}, not a {1}. so parse to {2} first.'.format('string', 'num', 'num') => This is a string not a num. so parse to num first.
 * 'This is a {0}, not a {1}. so parse to {1} first.'.format('string', 'num') => This is a string not a num. so parse to num first.
 * 'This is a {0}, not a {1}. so parse to {2} first.'.format('string', 'num') => This is a string not a num. so parse to {2} first.
 */
String.prototype.format = function() {
	var args = arguments;
	return this.replace(/\{(\d+)\}/g, function(){
		var val = args[arguments[1]];
		return (! val) ? arguments[0] : val;
	});
};

/**
 * trim string
 */
String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g, '');
};

(function(){
	// all rules regexs in all lang
	var ALL_RULES = {
		// blank
		space: {
			name: 'space',
			handler: function(rule) {
				return rule;
			}
		},
		// plain text
		plain: {
			name: 'plain',
			handler: function(rule) {
				return rule;
			}
		},
		// commet
		comment: {
			name: 'comment',
			handler: function(rule) {
				var commentRule = [];
				if (typeof rule == 'object' && rule[0]) {
					commentRule = rule;
				} else if (typeof rule == 'string') {
					commentRule.push(rule);
				}
				var regs = [];
				for (var i = commentRule.length; --i >= 0;) {
					commentRule[i] = commentRule[i].trim();
					if (commentRule[i].length == 0) {
						continue;
					}

					if (commentRule[i].indexOf(' ') != -1) {
						var coms = commentRule[i].split(/\s+/);
						var comOn = coms[0];
						var comOff = coms[1];
						regs.push('(?:{0}[\\s\\S]*?{1})'.format(comOn.replace(/\*/g, '\\*'),
							comOff.replace(/\*/g, '\\*')));
					} else {
						regs.push('(?:{0}[^\\r\\n]*)'.format(commentRule[i]));
					}
				}

				return '{0}'.format(regs.join('|'));
			}
		},
		// keywords
		keyword: {
			name: 'keyword',
			handler: function(rule) {
				return combineKeywordsRegex(rule);
			}
		},
		// functions
		func: {
			name: 'func',
			handler: function(rule) {
				return combineKeywordsRegex(rule);
			}
		},
		// objects
		object: {
			name: 'object',
			handler: function(rule) {
				return combineKeywordsRegex(rule);
			}
		},
		// string regex
		string: {
			name: 'string',
			handler: function(rule) {
				var stringQuotes = rule.split(/\s+/);
				var regs = [];
				for (var i = stringQuotes.length; --i >= 0;) {
					if (stringQuotes.length > 0) {
						regs.push('(?:{0}[^{0}\\\\\\r\\n]*(?:\\\\.[^{0}\\\\\\r\\n]*)*{0})'.format(stringQuotes[i]));
					}
				}
				return '{0}'.format(regs.join('|'));
			}
		},
		// delimiter regex
		delimiter: {
			name: 'delimiter',
			handler: function(rule) {
				return '[{0}]'.format(rule.replace(/([\\\[\]\-])/g, '\\$1'));
			}
		},
		// operators
		operator: {
			name: 'operator',
			handler: function(rule) {
				var operators = rule.split(/\s+/);
				operators.sort(function(val1, val2){
						if (val1.length >= val2.length)
							return -1;
						else
							return 1;
					});

				for (var i = operators.length; --i >= 0;) {
					operators[i] = operators[i].replace(/([|*?+^])/g, '\\$1');
				}

				return '{0}'.format(operators.join('|'));
			}
		}
	};

	function combineKeywordsRegex(keywords) {
		var kws = keywords.split(/\s+/g);
		kws.sort(function(val1, val2) {
			if (val1.length < val2.length)
				return 1;
			else
				return -1;
		});
		return '(?:{0})\\b'.format(kws.join('|'));
	}

	// all lang's rules mapping, key:lang , value: rules
	var ALL_LANG_RULES = {};
	var ALL_LANG_ALIASES = {};
	// default lang name
	var DEFAULT_LANG = 'default-lang';

	/**
	 * this object means which code will be beautified.
	 * @field lang              langname
	 * @field node              the node object like 'pre'
	 * @field code              the source code
	 * @field decoratedCode     code decorated with html
	 */
	function Code(node) {
		this.id = 0;
		var lang = node.getAttribute('lang');
		this.lang = (! lang) ? DEFAULT_LANG :
			(lang.trim() == '' ? DEFAULT_LANG : lang.trim());
		this.lang = this.lang.toLowerCase();

		this.node = node;
		this.code = (
			(node.nodeName.toLowerCase() == 'textarea') ? (node.value) :
				(node.innerHTML)
			);
	}

	/**
	 * a simple lexer who will analyse source code, split source code to
	 * rule units and combine them by line.
	 */
	function SimpleLexer(lang, sourceCode) {
		this.lang = lang;
		this.sourceCode = sourceCode.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&apos;/g, "'")
						.replace(/&quot;/g, '"')
						.replace(/&amp;/g, '&')
						.replace(/&nbsp;/g, ' ');

		if (typeof this.analyse != 'function') {
			function Unit(type, value) {
				this.type = type;
				this.value = value;
			}

//			Unit.prototype.toString = function() {
//				return '{type: ' + this.type + ', value: ' + this.value + '}';
//			};
			SimpleLexer.prototype.analyse = function () {
				var langRegex = new LangRegexFactory().getLangRegex(this.lang);

				var lines = [];
				var line = [];
				var matchs, type, content, regex = /^(.*?)\r?\n/gm;
				while ((matchs = langRegex.regex.exec(this.sourceCode)) != null) {

					for (var i = 1; i < matchs.length; i++) {
						if (matchs[i]) {
							break;
						}
					}

					type = langRegex.rules[i];
					content = matchs[i].replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/ /g, '&nbsp;');
							
					if (content.indexOf('\n') != -1) {
						var ms;
						var lastIndex = 0;
						while ((ms = regex.exec(content)) != null) {
							if (ms[1].length > 0) {
								line.push(new Unit(type, ms[1]));
							}
							lines[lines.length] = line;
							line = [];
							lastIndex = regex.lastIndex;
						}

						if (lastIndex < content.length) {
							line.push(new Unit(type, content.substring(lastIndex)));
						}
					} else {
						line.push(new Unit(type, content));
					}
				}

				if (line.length > 0) {
					lines.push(line);
				}

				return lines;
			};
		}
	}

	/**
	 * regex factory which create regex by lang
	 */
	function LangRegexFactory() {
		if (typeof getLangRegex != 'function') {
			var allLangRegexs = {};
			LangRegexFactory.prototype.getLangRegex = function(lang) {
				if (! allLangRegexs[DEFAULT_LANG]) {
					init();
				}
				lang = ALL_LANG_ALIASES[lang] ? ALL_LANG_ALIASES[lang] : DEFAULT_LANG;
				return allLangRegexs[lang] ? allLangRegexs[lang] : allLangRegexs[DEFAULT_LANG];
			}

			function init() {
				for (var lang in ALL_LANG_RULES) {
					var langRule = ALL_LANG_RULES[lang].rules;
					var regs = [], regexRules = [''];
					for (var ruleName in langRule) {
						regs.push('({0})'.format(ALL_RULES[ruleName].handler(langRule[ruleName])));
						regexRules.push(ruleName);
					}

					if (lang != DEFAULT_LANG) {
						var defaultCodeRule = ALL_LANG_RULES[DEFAULT_LANG].rules;
						for (ruleName in defaultCodeRule) {
							if (langRule[ruleName])
								continue;

							regs.push('({0})'.format(ALL_RULES[ruleName].handler(defaultCodeRule[ruleName])));
							regexRules.push(ruleName);
						}
					}

					var caseSensitive = '';
					if (ALL_LANG_RULES[lang].caseSensitive == false) {
						caseSensitive = 'i';
					}

					allLangRegexs[lang] = {rules: regexRules, regex: new RegExp(regs.join('|'), ('g' + caseSensitive))};
				}
			}
		}
	}

	/**
	 * decorate code to html.
	 * @param codeNode   the node object who will be decoratored
	 * @param options    decorating options
	 */
	function HtmlDecorator(codeNode, options) {
		this.code = new Code(codeNode);
		this.options = options;

		if (typeof this.decorate != 'function') {
			function decorateCode(lines, options) {
					var html = [(options.linenum ? '<table class="linenum"><tr>' : '<table><tr>')];
					var count = lines.length;
					if (options.linenum) {
						html.push('<th><pre>');
						for (var i = 1; i <= count; i++) {
							html.push('<div>' + i + '</div>');
						}
						html.push('</pre></th>');
					}

					html.push('<td><pre>');
					for (var i = 0; i < count; i++) {
						html.push(options.zebra && i % 2 != 0 ? '<div class="odd">' : '<div>');
						var line = lines[i];
						if (line.length == 0) {
							html.push('&nbsp;');
						}

						for (var j = 0; j < line.length; j++) {
							var tmp = line[j];
							var content = tmp.value.replace(/\t/g, options.tabSpaces);
							var css = ALL_RULES[tmp.type].css ? ALL_RULES[tmp.type].css : tmp.type;

							html.push('<span class="{0}">{1}</span>'.format(css, content));
						}
						
						html.push('</div>');
					}
					html.push('</pre></td></tr></table>');
					return html;
				}

			HtmlDecorator.prototype.decorate = function() {
				var lexer = new SimpleLexer(this.code.lang, this.code.code);
				var lines = lexer.analyse();
				var html = decorateCode(lines, this.options);
				this.code.decoratedCode = html.join('');
				return this.code;
			};
		}
	}


	/**
	 * @param option
	 *   tags: such as 'pre'(default), 'textarea', 'pre textarea'
	 *   tab: default value 4 means tab will be replaced by 4 blank spaces.
	 *   linenum: true/false. show or hidden linenum
	 *   zebra: true/false. show or hidden zebra stripes.
	 *   theme: ''  choose theme. this version has no theme choosen.
	 */
	function Beautifier(option) {
		var options = defaultOption(option);

		this.beautify = function() {
			var codeNodes = getElements(options.tags);
			for (var i = codeNodes.length-1; i >= 0; i--) {
				var code = (new HtmlDecorator(codeNodes[i], options)).decorate();
				beautifySingle(code);
			}
		};

		function getElements(tags) {
			var es = [];
			for (var i = tags.length; --i >=0;) {
				var tes = document.getElementsByTagName(tags[i]);
				for (var j = 0; j < tes.length; j++) {
					es.push(tes[j]);
				}
			}

			return es;
		}

		function defaultOption(option) {
			var op = option ? option : {};
			op.tags = op.tags ? op.tags : 'pre';
			var tags = op.tags.split(/\s+/);
			op.tags = [];
			for (var i = tags.length; --i >= 0; ) {
				if (tags[i] == 'pre' || tags[i] == 'textarea')
					op.tags.push(tags[i]);
			}

			op.tab = op.tab ? parseInt(op.tab) : 4;
			op.tabSpaces = '';
			for (i = op.tab; --i >= 0; ) {
				op.tabSpaces += '&nbsp;';
			}

			op.titlebar = (op.titlebar === true ? true : false);
			op.theme = (op.theme ? op.theme : '');
			op.zebra = (op.zebra === true ? true : false);
			op.linenum = (op.linenum === false ? false : true);

			return op;
		}

		function beautifySingle(code) {
			var codePanel = document.createElement('div');
			codePanel.setAttribute('creator', 'codebeautifier');
			codePanel.className = 'ssh_wrapper ' + (options.theme.length > 0 ? (' ' + options.theme) : '');

			var decoratedHtml = '';

			if (options.titlebar)
				decoratedHtml = '<div class="ssh_panel"><div class="ssh_titlebar">{0} code</div>{1}</div>'.format(code.lang, code.decoratedCode);
			else
				decoratedHtml = '<div class="ssh_panel">{0}</div>'.format(code.decoratedCode);

			codePanel.innerHTML = decoratedHtml;
			var node = code.node;
			node.parentNode.replaceChild(codePanel, node);
		}
	}

	var SimpleSyntaxHighlighting = {
		Beautifier: Beautifier,
		addLangRules: function(lrs) {
			if (! lrs.lang || lrs.lang.trim() == '') {
				return;
			}
			lrs.lang = lrs.lang.trim();
			if (ALL_LANG_RULES[lrs.lang]) {
				return;
			}

			for (var ruleName in lrs.rules) {
				if (! ALL_RULES[ruleName]) {
					delete lrs.rules[ruleName];
				}
			}

			ALL_LANG_RULES[lrs.lang] = {};
			ALL_LANG_RULES[lrs.lang].rules = lrs.rules;
			ALL_LANG_RULES[lrs.lang].caseSensitive = (lrs.caseSensitive === false ? false : true);
			ALL_LANG_RULES[lrs.lang].alias = lrs.alias;

			ALL_LANG_ALIASES[lrs.lang] = lrs.lang;
			if (lrs.alias) {
				lrs.alias = lrs.alias.split(/\s+/);
				for (var i = lrs.alias.length; --i >= 0;) {
					ALL_LANG_ALIASES[lrs.alias[i]] = lrs.lang;
				}
			}
		},

		/**
		 * add a new rule
		 * @param rule like {name: 'string', handler: function(rule){}, css: 'string'}
		 */
		addRules: function(rule) {
			if (!rule.name || !rule.handler || 
					(typeof rule.handler != 'function') ||
					ALL_RULES[rule.name]) {

				return;
			}

			ALL_RULES[rule.name] = rule;
		}
	};

	// set default code rules.
	SimpleSyntaxHighlighting.addLangRules({
		lang: DEFAULT_LANG,
		rules: {
//			keyword: 'if else for while break continue',
//			string: '"',
//			comment: ['//', '/* */'],
//			operator: '= += -= *= /= + - * / % ++ -- < <= > >= == != & && | || ^ == != ! ? :',
			delimiter: '~!#@%^&*()-+=|\\/{}[]:;"\'<>,.?',
			space: '\\s+',
			plain: '[\\$A-Za-z0-9_-]+'
		}
	});

	if (!window['ssh']) {
		window['ssh'] = SimpleSyntaxHighlighting;
	}
	window['SimpleSyntaxHighlighting'] = SimpleSyntaxHighlighting;
})();

//Java
ssh.addLangRules({
	lang: 'java',
	rules: {
		string: '"',
		comment: ['//', '/* */'],
		keyword : 'abstract boolean break byte case catch char class continue default do double else extends false final finally float for if implements import instanceof int interface long native new null package private protected public return short static super switch synchronized this throw throws transient true try void volatile while'
	}
});

// Javascript
ssh.addLangRules({
	lang: 'javascript',
	alias: 'js jscript',
	rules : {
		string: '" \'',
		comment: ['//', '/* */'],
		keyword: 'break case catch continue debugger default delete do else false finally for function if in instanceof new null return switch this throw true try typeof var void while with',
		object: 'Object Function Array String Boolean Number Date RegExp Error EvalError RangeError ReferenceError SyntaxError TypeError URIError window document'
	}
});

// C
ssh.addLangRules({
	lang: 'c',
	rules: {
		string: '"',
		comment: ['//', '/* */'],
		keyword: '#define #elif #else #endif #error #if #ifdef #ifndef #include #include_next #line #pragma #undef __asm __based __cdecl __declspec __except __far __fastcall __finally __fortran __huge __inline __int16 __int32 __int64 __int8 __interrupt __leave __loadds __near __pascal __saveregs __segment __segname __self __stdcall __try __uuidof auto bool break case char const continue default defined do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while',
		func: 'abort abs acos asctime asin assert atan atan2 atexit atof atoi atol bsearch calloc ceil clearerr clock cos cosh ctime difftime div exit exp fabs fclose feof ferror fflush fgetc fgetpos fgets floor fmod fopen fprintf fputc fputs fread free freopen frexp fscanf fseek fsetpos ftell fwrite getc getchar getenv gets gmtime isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper isxdigit labs ldexp ldiv localtime log log10 longjmp main malloc memchr memcmp memcpy memmove memset mktime modf offsetof perror pow printf putc putchar puts qsort raise rand realloc remove rename rewind scanf setbuf setjmp setvbuf sin sinh sizeof snprintf sprintf sqrt srand sscanf strcat strchr strcmp strcoll strcpy strcspn strerror strftime strlen strncat strncmp strncpy strpbrk strrchr strspn strstr strtod strtok strtol strtoul strxfrm system tan tanh time tmpfile tmpnam tolower toupper ungetc va_arg va_end va_start vfprintf vfscanf vprintf vscanf vsnprintf vsprintf vsscanf'
	}
});

// C++
ssh.addLangRules({
	lang: 'cpp',
	alias: 'c++',
	rules: {
		string: '"',
		comment: ['//', '/* */'],
		keyword: '__declspec __exception __finally __try break case catch class const const_cast continue default delete deprecated dllexport dllimport do dynamic_cast else enum explicit extern false for friend goto if inline mutable naked namespace new noinline noreturn nothrow private protected public register reinterpret_cast return selectany sizeof static static_cast struct switch template this thread throw true try typedef typeid typename union using uuid virtual void volatile whcar_t while',
		func: 'abort abs acos asctime asin assert atan atan2 atexit atof atoi atol bsearch calloc ceil clearerr clock cos cosh ctime difftime div errno exit exp fabs fclose feof ferror fflush fgetc fgetpos fgets floor fmod fopen fprintf fputc fputs fread free freopen frexp fscanf fseek fsetpos ftell fwrite getc getchar getenv gets gmtime isalnum isalpha iscntrl isdigit isgraph islower isprint ispunct isspace isupper isxdigit jmp_buf labs ldexp ldiv localeconv localtime log log10 longjmp malloc mblen mbstowcs mbtowc memchr memcmp memcpy memmove memset mktime modf perror pow printf putc putchar puts qsort raise rand realloc remove rename rewind scanf setbuf setjmp setlocale setvbuf sig_atomic_t signal sin sinh sprintf sqrt srand sscanf strcat strchr strcmp strcoll strcpy strcspn strerror strftime strlen strncat strncmp strncpy strpbrk strrchr strspn strstr strtod strtok strtol strtoul strxfrm system tan tanh time tmpfile tmpnam tolower toupper ungetc va_arg va_end va_start vfprintf vprintf vsprintf wcstombs wctomb'
	}
});

// PHP
ssh.addLangRules({
	lang: 'php',
	rules: {
		string: '" \'',
		comment: ['//', '#', '/* */'],
		keyword: 'false true abstract and as break case catch cfunction class clone const continue declare default die do else elseif enddeclare endfor endforeach endif endswitch endwhile extends final for foreach function include include_once global goto if implements interface instanceof namespace new old_function or private protected public return require require_once static switch throw try use var while xor',
//		func: 'print echo abs acos acosh addcslashes addslashes apache_child_terminate apache_lookup_uri apache_note apache_setenv array array_change_key_case array_chunk array_count_values array_diff array_fill array_filter array_flip array_intersect array_key_exists array_keys array_map array_merge array_merge_recursive array_multisort array_pad array_pop array_push array_rand array_reduce array_reverse array_search array_shift array_slice array_splice array_sum array_unique array_unshift array_values array_walk arsort ascii2ebcdic asin asinh asort aspell_check aspell_check_raw aspell_new aspell_suggest assert assert_options atan atan2 atanh base64_decode base64_encode base_convert basename bcadd bccomp bcdiv bcmod bcmul bcpow bcscale bcsqrt bcsub bin2hex bind_textdomain_codeset bindec bindtextdomain bz bzclose bzdecompress bzerrno bzerror bzerrstr bzflush bzopen bzread bzwrite c cal_days_in_month cal_from_jd cal_info cal_to_jd call_user_func call_user_func_array call_user_method call_user_method_array ccvs_add ccvs_auth ccvs_command ccvs_count ccvs_delete ccvs_done ccvs_init ccvs_lookup ccvs_new ccvs_report ccvs_return ccvs_reverse ccvs_sale ccvs_status ccvs_textvalue ccvs_void ceil chdir checkdate checkdnsrr chgrp chmod chop chown chr chroot chunk_split class_exists clearstatcache closedir closelog com com_addref com_get com_invoke com_isenum com_load com_load_typelib com_propget com_propput com_propset com_release com_set compact connection_aborted connection_status connection_timeout constant convert_cyr_string copy cos cosh count count_chars cpdf_add_annotation cpdf_add_outline cpdf_arc cpdf_begin_text cpdf_circle cpdf_clip cpdf_close cpdf_closepath cpdf_closepath_fill_stroke cpdf_closepath_stroke cpdf_continue_text cpdf_curveto cpdf_end_text cpdf_fill cpdf_fill_stroke cpdf_finalize cpdf_finalize_page cpdf_global_set_document_limits cpdf_import_jpeg cpdf_lineto cpdf_moveto cpdf_newpath cpdf_open cpdf_output_buffer cpdf_page_init cpdf_place_inline_image cpdf_rect cpdf_restore cpdf_rlineto cpdf_rmoveto cpdf_rotate cpdf_rotate_text cpdf_save cpdf_save_to_file cpdf_scale cpdf_set_action_url cpdf_set_char_spacing cpdf_set_creator cpdf_set_current_page cpdf_set_font cpdf_set_font_directories cpdf_set_font_map_file cpdf_set_horiz_scaling cpdf_set_keywords cpdf_set_leading cpdf_set_page_animation cpdf_set_subject cpdf_set_text_matrix cpdf_set_text_pos cpdf_set_text_rise cpdf_set_title cpdf_set_viewer_preferences cpdf_set_word_spacing cpdf_setdash cpdf_setflat cpdf_setgray cpdf_setgray_fill cpdf_setgray_stroke cpdf_setlinecap cpdf_setlinejoin cpdf_setlinewidth cpdf_setmiterlimit cpdf_setrgbcolor cpdf_setrgbcolor_fill cpdf_setrgbcolor_stroke cpdf_show cpdf_show_xy cpdf_stringwidth cpdf_stroke cpdf_text cpdf_translate crack_check crack_closedict crack_getlastmessage crack_opendict crc32 create_function crypt ctype_alnum ctype_alpha ctype_cntrl ctype_digit ctype_graph ctype_lower ctype_print ctype_punct ctype_space ctype_upper ctype_xdigit curl_close curl_errno curl_error curl_exec curl_getinfo curl_init curl_setopt curl_version current cybercash_base64_decode cybercash_base64_encode cybercash_decr cybercash_encr cybermut_creerformulairecm cybermut_creerreponsecm cybermut_testmac cyrus_authenticate cyrus_bind cyrus_close cyrus_connect cyrus_query cyrus_unbind date dba_close dba_delete dba_exists dba_fetch dba_firstkey dba_insert dba_nextkey dba_open dba_optimize dba_popen dba_replace dba_sync dbase_add_record dbase_close dbase_create dbase_delete_record dbase_get_record dbase_get_record_with_names dbase_numfields dbase_numrecords dbase_open dbase_pack dbase_replace_record dblist dbmclose dbmdelete dbmexists dbmfetch dbmfirstkey dbminsert dbmnextkey dbmopen dbmreplace dbp dbplus_add dbplus_aql dbplus_chdir dbplus_close dbplus_curr dbplus_errcode dbplus_errno dbplus_find dbplus_first dbplus_flush dbplus_freealllocks dbplus_freelock dbplus_freerlocks dbplus_getlock dbplus_getunique dbplus_info dbplus_last dbplus_lockrel dbplus_next dbplus_open dbplus_rchperm dbplus_rcreate dbplus_rcrtexact dbplus_rcrtlike dbplus_resolve dbplus_restorepos dbplus_rkeys dbplus_ropen dbplus_rquery dbplus_rrename dbplus_rsecindex dbplus_runlink dbplus_rzap dbplus_savepos dbplus_setindex dbplus_setindexbynumber dbplus_sql dbplus_tcl dbplus_tremove dbplus_undo dbplus_undoprepare dbplus_unlockrel dbplus_unselect dbplus_update dbplus_xlockrel dbplus_xunlockrel dbx_close dbx_compare dbx_connect dbx_error dbx_query dbx_sort dcgettext dcngettext debugger_off debugger_on decbin dechex decoct define define_syslog_variables defined deg2rad delete dgettext die dio_close dio_fcntl dio_open dio_read dio_seek dio_stat dio_truncate dio_write dir dirname disk_free_space disk_total_space diskfreespace dl dngettext domxml_add_root domxml_attributes domxml_children domxml_dumpmem domxml_get_attribute domxml_new_child domxml_new_xmldoc domxml_node domxml_node_set_content domxml_node_unlink_node domxml_root domxml_set_attribute domxml_version dotnet_load doubleval each easter_date easter_days ebcdic2ascii empty end ereg ereg_replace eregi eregi_replace error_log error_reporting escapeshellarg escapeshellcmd eval exec exif_imagetype exif_read_data exif_thumbnail exit exp explode expm1 extension_loaded extract ezmlm_hash fbsql_affected_rows fbsql_autocommit fbsql_change_user fbsql_close fbsql_commit fbsql_connect fbsql_create_blob fbsql_create_clob fbsql_create_db fbsql_data_seek fbsql_database fbsql_database_password fbsql_db_query fbsql_db_status fbsql_drop_db fbsql_errno fbsql_error fbsql_fetch_a fbsql_fetch_assoc fbsql_fetch_field fbsql_fetch_lengths fbsql_fetch_object fbsql_fetch_row fbsql_field_flags fbsql_field_len fbsql_field_name fbsql_field_seek fbsql_field_table fbsql_field_type fbsql_free_result fbsql_get_autostart_info fbsql_hostname fbsql_insert_id fbsql_list_dbs fbsql_list_fields fbsql_list_tables fbsql_next_result fbsql_num_fields fbsql_num_rows fbsql_password fbsql_pconnect fbsql_query fbsql_read_blob fbsql_read_clob fbsql_result fbsql_rollback fbsql_select_db fbsql_set_lob_mode fbsql_set_transaction fbsql_start_db fbsql_stop_db fbsql_tablename fbsql_username fbsql_warnings fclose fdf_add_template fdf_close fdf_create fdf_get_file fdf_get_status fdf_get_value fdf_next_field_name fdf_open fdf_save fdf_set_ap fdf_set_encoding fdf_set_file fdf_set_flags fdf_set_javascript_action fdf_set_opt fdf_set_status fdf_set_submit_form_action fdf_set_value feof fflush fgetc fgetcsv fgets fgetss fgetwrapperdata file file_exists file_get_contents fileatime filectime filegroup fileinode filemtime fileowner fileperms filepro filepro_fieldcount filepro_fieldname filepro_fieldtype filepro_fieldwidth filepro_retrieve filepro_rowcount filesize filetype floatval flock floor flush fopen fpassthru fputs fread frenchtojd fribidi_log2vis fscanf fseek fsockopen fstat ftell ftok ftp_cdup ftp_chdir ftp_close ftp_connect ftp_delete ftp_exec ftp_fget ftp_fput ftp_get ftp_get_option ftp_login ftp_mdtm ftp_mkdir ftp_nlist ftp_pasv ftp_put ftp_pwd ftp_quit ftp_rawlist ftp_rename ftp_rmdir ftp_set_option ftp_site ftp_size ftp_systype ftruncate func_get_arg func_get_args func_num_args function_exists fwrite get_browser get_cfg_var get_class get_class_methods get_class_vars get_current_user get_declared_classes get_defined_constants get_defined_functions get_defined_vars get_extension_funcs get_html_translation_table get_include_p get_included_files get_loaded_extensions get_magic_quotes_gpc get_magic_quotes_runtime get_meta_tags get_object_vars get_parent_class get_required_files get_resource_type getallheaders getcwd getdate getenv gethostbyaddr gethostbyname gethostbynamel getimagesize getlastmod getmxrr getmygid getmyinode getmypid getmyuid getprotobyname getprotobynumber getrandmax getrusage getservbyname getservbyport gettext gettimeofday gettype global gmdate gmmktime gmp_abs gmp_add gmp_and gmp_clrbit gmp_cmp gmp_com gmp_div gmp_div_q gmp_div_qr gmp_div_r gmp_divexact gmp_fact gmp_gcd gmp_gcdext gmp_hamdist gmp_init gmp_intval gmp_invert gmp_jacobi gmp_legendre gmp_mod gmp_mul gmp_neg gmp_or gmp_perfect_square gmp_popcount gmp_pow gmp_powm gmp_prob_prime gmp_random gmp_scan0 gmp_scan1 gmp_setbit gmp_sign gmp_sqrt gmp_sqrtrem gmp_strval gmp_sub gmp_xor gmstrftime gregoriantojd gzclose gzcompress gzdeflate gzencode gzeof gzfile gzgetc gzgets gzgetss gzinflate gzopen gzpassthru gzputs gzread gzrewind gzseek gztell gzuncompress gzwrite header headers_sent hebrev hebrevc hexdec highlight_file highlight_string htmlentities htmlspecialchars hw_array2objrec hw_c hw_children hw_childrenobj hw_close hw_connect hw_connection_info hw_cp hw_deleteobject hw_docbyanchor hw_docbyanchorobj hw_document_attributes hw_document_bodytag hw_document_content hw_document_setcontent hw_document_size hw_dummy hw_edittext hw_error hw_errormsg hw_free_document hw_getanchors hw_getanchorsobj hw_getandlock hw_getchildcoll hw_getchildcollobj hw_getchilddoccoll hw_getchilddoccollobj hw_getobject hw_getobjectbyquery hw_getobjectbyquerycoll hw_getobjectbyquerycollobj hw_getobjectbyqueryobj hw_getparents hw_getparentsobj hw_getrellink hw_getremote hw_getremotechildren hw_getsrcbydestobj hw_gettext hw_getusername hw_identify hw_incollections hw_info hw_inscoll hw_insdoc hw_insertanchors hw_insertdocument hw_insertobject hw_mapid hw_modifyobject hw_mv hw_new_document hw_objrec2array hw_output_document hw_pconnect hw_pipedocument hw_root hw_setlinkroot hw_stat hw_unlock hw_who hypot i ibase_blob_add ibase_blob_cancel ibase_blob_close ibase_blob_create ibase_blob_echo ibase_blob_get ibase_blob_import ibase_blob_info ibase_blob_open ibase_close ibase_commit ibase_connect ibase_errmsg ibase_execute ibase_fetch_object ibase_fetch_row ibase_field_info ibase_free_query ibase_free_result ibase_num_fields ibase_pconnect ibase_prepare ibase_query ibase_rollback ibase_timefmt ibase_trans icap_close icap_create_calendar icap_delete_calendar icap_delete_event icap_fetch_event icap_list_alarms icap_list_events icap_open icap_rename_calendar icap_reopen icap_snooze icap_store_event iconv iconv_get_encoding iconv_set_encoding ifx_affected_rows ifx_blobinfile_mode ifx_byteasvarchar ifx_close ifx_connect ifx_copy_blob ifx_create_blob ifx_create_char ifx_do ifx_error ifx_errormsg ifx_fetch_row ifx_fieldproperties ifx_fieldtypes ifx_free_blob ifx_free_char ifx_free_result ifx_get_blob ifx_get_char ifx_getsqlca ifx_htmltbl_result ifx_nullformat ifx_num_fields ifx_num_rows ifx_pconnect ifx_prepare ifx_query ifx_textasvarchar ifx_update_blob ifx_update_char ifxus_close_slob ifxus_create_slob ifxus_free_slob ifxus_open_slob ifxus_read_slob ifxus_seek_slob ifxus_tell_slob ifxus_write_slob ignore_user_abort image2wbmp imagealphablending imageantialias imagearc imagechar imagecharup imagecolorallocate imagecolorat imagecolorclosest imagecolorclosestalpha imagecolorclosesthwb imagecolordeallocate imagecolorexact imagecolorexactalpha imagecolorresolve imagecolorresolvealpha imagecolorset imagecolorsforindex imagecolorstotal imagecolortransparent imagecopy imagecopymerge imagecopymergegray imagecopyresampled imagecopyresized imagecreate imagecreatefromgd imagecreatefromgd2 imagecreatefromgd2part imagecreatefromgif imagecreatefromjpeg imagecreatefrompng imagecreatefromstring imagecreatefromwbmp imagecreatefromxbm imagecreatefromxpm imagecreatetruecolor imagedashedline imagedestroy imageellipse imagefill imagefilledarc imagefilledellipse imagefilledpolygon imagefilledrectangle imagefilltoborder imagefontheight imagefontwidth imageftbbox imagefttext imagegammacorrect imagegd imagegd2 imagegif imageinterlace imagejpeg imageline imageloadfont imagepalettecopy imagepng imagepolygon imagepsbbox imagepsencodefont imagepsextendfont imagepsfreefont imagepsloadfont imagepsslantfont imagepstext imagerectangle imagesetbrush imagesetpixel imagesetstyle imagesetthickness imagesettile imagestring imagestringup imagesx imagesy imagetruecolortopalette imagettfbbox imagettftext imagetypes imagewbmp imap_8bit imap_append imap_base64 imap_binary imap_body imap_bodystruct imap_check imap_clearflag_full imap_close imap_createmailbox imap_delete imap_deletemailbox imap_errors imap_expunge imap_fetch_overview imap_fetchbody imap_fetchheader imap_fetchstructure imap_get_quota imap_getmailboxes imap_getsubscribed imap_header imap_headerinfo imap_headers imap_last_error imap_listmailbox imap_listsubscribed imap_mail imap_mail_compose imap_mail_copy imap_mail_move imap_mailboxmsginfo imap_mime_header_decode imap_msgno imap_num_msg imap_num_recent imap_open imap_ping imap_popen imap_qprint imap_renamemailbox imap_reopen imap_rfc822_parse_adrlist imap_rfc822_parse_headers imap_rfc822_write_address imap_scanmailbox imap_search imap_set_quota imap_setacl imap_setflag_full imap_sort imap_status imap_subscribe imap_thread imap_uid imap_undelete imap_unsubscribe imap_utf7_decode imap_utf7_encode imap_utf8 implode import_request_variables in_array include include_once ingres_autocommit ingres_close ingres_commit ingres_connect ingres_fetch_array ingres_fetch_object ingres_fetch_row ingres_field_length ingres_field_name ingres_field_nullable ingres_field_precision ingres_field_scale ingres_field_type ingres_num_fields ingres_num_rows ingres_pconnect ingres_query ingres_rollback ini_alter ini_get ini_get_all ini_restore ini_set intval ip2long iptcembed iptcparse ircg_channel_mode ircg_disconnect ircg_fetch_error_msg ircg_get_username ircg_html_encode ircg_ignore_add ircg_ignore_del ircg_is_conn_alive ircg_join ircg_kick ircg_lookup_format_messages ircg_msg ircg_nick ircg_nickname_escape ircg_nickname_unescape ircg_notice ircg_part ircg_pconnect ircg_register_format_messages ircg_set_current ircg_set_file ircg_topic ircg_whois is_a is_array is_bool is_callable is_dir is_double is_executable is_file is_finite is_float is_infinite is_int is_integer is_link is_long is_nan is_null is_numeric is_object is_readable is_real is_resource is_scalar is_string is_subclass_of is_uploaded_file is_writable is_writeable java_last_exception_clear java_last_exception_get jddayofweek jdmonthname jdtofrench jdtogregorian jdtojewish jdtojulian jdtounix jewishtojd join jpeg2wbmp juliantojd key krsort ksort lcg_value ldap_8859_to_t61 ldap_add ldap_bind ldap_close ldap_compare ldap_connect ldap_count_entries ldap_delete ldap_dn2ufn ldap_err2str ldap_errno ldap_error ldap_explode_dn ldap_first_attribute ldap_first_entry ldap_first_reference ldap_free_result ldap_get_attributes ldap_get_dn ldap_get_entries ldap_get_option ldap_get_values ldap_get_values_len ldap_list ldap_mod_add ldap_mod_del ldap_mod_replace ldap_modify ldap_next_attribute ldap_next_entry ldap_next_reference ldap_parse_reference ldap_parse_result ldap_read ldap_rename ldap_search ldap_set_option ldap_set_rebind_proc ldap_sort ldap_start_tls ldap_t61_to_8859 ldap_unbind leak levenshtein link linkinfo list localeconv localtime log log10 log1p long2ip lstat ltrim mail mailparse_determine_best_xfer_encoding mailparse_msg_create mailparse_msg_extract_part mailparse_msg_extract_part_file mailparse_msg_free mailparse_msg_get_part mailparse_msg_get_part_data mailparse_msg_get_structure mailparse_msg_parse mailparse_msg_parse_file mailparse_rfc822_parse_addresses mailparse_stream_encode mailparse_uudecode_all max mb_c mb_convert_kana mb_convert_variables mb_decode_mimeheader mb_decode_numericentity mb_detect_encoding mb_detect_order mb_encode_mimeheader mb_encode_numericentity mb_ereg mb_ereg_match mb_ereg_replace mb_ereg_search mb_ereg_search_getpos mb_ereg_search_getregs mb_ereg_search_init mb_ereg_search_pos mb_ereg_search_regs mb_ereg_search_setpos mb_eregi mb_eregi_replace mb_get_info mb_http_input mb_http_output mb_internal_encoding mb_language mb_output_handler mb_parse_str mb_preferred_mime_name mb_regex_encoding mb_send_mail mb_split mb_strcut mb_strimwidth mb_strlen mb_strpos mb_strrpos mb_strwidth mb_substitute_character mb_substr mcal_append_event mcal_close mcal_create_calendar mcal_date_compare mcal_date_valid mcal_day_of_week mcal_day_of_year mcal_days_in_month mcal_delete_calendar mcal_delete_event mcal_event_add_attribute mcal_event_init mcal_event_set_alarm mcal_event_set_category mcal_event_set_class mcal_event_set_description mcal_event_set_end mcal_event_set_recur_daily mcal_event_set_recur_monthly_mday mcal_event_set_recur_monthly_wday mcal_event_set_recur_none mcal_event_set_recur_weekly mcal_event_set_recur_yearly mcal_event_set_start mcal_event_set_title mcal_expunge mcal_fetch_current_stream_event mcal_fetch_event mcal_is_leap_year mcal_list_alarms mcal_list_events mcal_next_recurrence mcal_open mcal_popen mcal_rename_calendar mcal_reopen mcal_snooze mcal_store_event mcal_time_valid mcal_week_of_year mcrypt_cbc mcrypt_cfb mcrypt_create_iv mcrypt_decrypt mcrypt_ecb mcrypt_enc_get_algorithms_name mcrypt_enc_get_block_size mcrypt_enc_get_iv_size mcrypt_enc_get_key_size mcrypt_enc_get_modes_name mcrypt_enc_get_supported_key_sizes mcrypt_enc_is_block_algorithm mcrypt_enc_is_block_algorithm_mode mcrypt_enc_is_block_mode mcrypt_enc_self_test mcrypt_encrypt mcrypt_generic mcrypt_generic_deinit mcrypt_generic_end mcrypt_generic_init mcrypt_get_block_size mcrypt_get_cipher_name mcrypt_get_iv_size mcrypt_get_key_size mcrypt_list_algorithms mcrypt_list_modes mcrypt_module_close mcrypt_module_get_algo_block_size mcrypt_module_get_algo_key_size mcrypt_module_get_supported_key_sizes mcrypt_module_is_block_algorithm mcrypt_module_is_block_algorithm_mode mcrypt_module_is_block_mode mcrypt_module_open mcrypt_module_self_test mcrypt_ofb md5 md5_file mdecrypt_generic metaphone method_exists mhash mhash_count mhash_get_block_size mhash_get_hash_name mhash_keygen_s2k microtime min ming_setcubicthreshold ming_setscale ming_useswfversion mkdir mktime move_uploaded_file msession_connect msession_count msession_create msession_destroy msession_disconnect msession_find msession_get msession_get_array msession_getdata msession_inc msession_list msession_listvar msession_lock msession_plugin msession_randstr msession_set msession_set_array msession_setdata msession_timeout msession_uniq msession_unlock msql msql_affected_rows msql_close msql_connect msql_create_db msql_createdb msql_data_seek msql_dbname msql_drop_db msql_dropdb msql_error msql_fetch_array msql_fetch_field msql_fetch_object msql_fetch_row msql_field_seek msql_fieldflags msql_fieldlen msql_fieldname msql_fieldtable msql_fieldtype msql_free_result msql_freeresult msql_list_dbs msql_list_fields msql_list_tables msql_listdbs msql_listfields msql_listtables msql_num_fields msql_num_rows msql_numfields msql_numrows msql_pconnect msql_query msql_regcase msql_result msql_select_db msql_selectdb msql_tablename mssql_bind mssql_close mssql_connect mssql_data_seek mssql_execute mssql_fetch_array mssql_fetch_assoc mssql_fetch_batch mssql_fetch_field mssql_fetch_object mssql_fetch_row mssql_field_length mssql_field_name mssql_field_seek mssql_field_type mssql_free_result mssql_get_last_message mssql_guid_string mssql_init mssql_min_error_severity mssql_min_message_severity mssql_next_result mssql_num_fields mssql_num_rows mssql_pconnect mssql_query mssql_result mssql_rows_affected mssql_select_db mt_getrandmax mt_rand mt_srand muscat_close muscat_get muscat_give muscat_setup muscat_setup_net mysql_affected_rows mysql_change_user mysql_character_set_name mysql_close mysql_connect mysql_create_db mysql_data_seek mysql_db_name mysql_db_query mysql_drop_db mysql_errno mysql_error mysql_escape_string mysql_fetch_array mysql_fetch_assoc mysql_fetch_field mysql_fetch_lengths mysql_fetch_object mysql_fetch_row mysql_field_flags mysql_field_len mysql_field_name mysql_field_seek mysql_field_table mysql_field_type mysql_free_result mysql_get_client_info mysql_get_host_info mysql_get_proto_info mysql_get_server_info mysql_info mysql_insert_id mysql_list_dbs mysql_list_fields mysql_list_processes mysql_list_tables mysql_num_fields mysql_num_rows mysql_pconnect mysql_ping mysql_query mysql_real_escape_string mysql_result mysql_select_db mysql_stat mysql_tablename mysql_thread_id mysql_unbuffered_query natcasesort natsort ncur ncurses_addch ncurses_addchnstr ncurses_addchstr ncurses_addnstr ncurses_addstr ncurses_assume_default_colors ncurses_attroff ncurses_attron ncurses_attrset ncurses_baudrate ncurses_beep ncurses_bkgd ncurses_bkgdset ncurses_border ncurses_can_change_color ncurses_cbreak ncurses_clear ncurses_clrtobot ncurses_clrtoeol ncurses_color_set ncurses_curs_set ncurses_def_prog_mode ncurses_def_shell_mode ncurses_define_key ncurses_delay_output ncurses_delch ncurses_deleteln ncurses_delwin ncurses_doupdate ncurses_echo ncurses_echochar ncurses_end ncurses_erase ncurses_erasechar ncurses_filter ncurses_flash ncurses_flushinp ncurses_getch ncurses_getmouse ncurses_halfdelay ncurses_has_ic ncurses_has_il ncurses_has_key ncurses_hline ncurses_inch ncurses_init ncurses_init_color ncurses_init_pair ncurses_insch ncurses_insdelln ncurses_insertln ncurses_insstr ncurses_instr ncurses_isendwin ncurses_keyok ncurses_killchar ncurses_longname ncurses_mouseinterval ncurses_mousemask ncurses_move ncurses_mvaddch ncurses_mvaddchnstr ncurses_mvaddchstr ncurses_mvaddnstr ncurses_mvaddstr ncurses_mvcur ncurses_mvdelch ncurses_mvgetch ncurses_mvhline ncurses_mvinch ncurses_mvvline ncurses_mvwaddstr ncurses_napms ncurses_newwin ncurses_nl ncurses_nocbreak ncurses_noecho ncurses_nonl ncurses_noqiflush ncurses_noraw ncurses_putp ncurses_qiflush ncurses_raw ncurses_refresh ncurses_resetty ncurses_savetty ncurses_scr_dump ncurses_scr_init ncurses_scr_restore ncurses_scr_set ncurses_scrl ncurses_slk_attr ncurses_slk_attroff ncurses_slk_attron ncurses_slk_attrset ncurses_slk_clear ncurses_slk_color ncurses_slk_init ncurses_slk_noutrefresh ncurses_slk_refresh ncurses_slk_restore ncurses_slk_touch ncurses_standend ncurses_standout ncurses_start_color ncurses_termattrs ncurses_termname ncurses_timeout ncurses_typeahead ncurses_ungetch ncurses_ungetmouse ncurses_use_default_colors ncurses_use_env ncurses_use_extended_names ncurses_vidattr ncurses_vline ncurses_wrefresh next ngettext nl2br nl_langinfo notes_body notes_copy_db notes_create_db notes_create_note notes_drop_db notes_find_note notes_header_info notes_list_msgs notes_mark_read notes_mark_unread notes_nav_create notes_search notes_unread notes_version number_format ob_clean ob_end_clean ob_end_flush ob_flush ob_get_contents ob_get_length ob_get_level ob_gzhandler ob_iconv_handler ob_implicit_flush ob_start ocibindbyname ocicancel ocicollappend ocicollassign ocicollassignelem ocicollgetelem ocicollmax ocicollsize ocicolltrim ocicolumnisnull ocicolumnname ocicolumnprecision ocicolumnscale ocicolumnsize ocicolumntype ocicolumntyperaw ocicommit ocidefinebyname ocierror ociexecute ocifetch ocifetchinto ocifetchstatement ocifreecollection ocifreecursor ocifreedesc ocifreestatement ociinternaldebug ociloadlob ocilogoff ocilogon ocinewcollection ocinewcursor ocinewdescriptor ocinlogon ocinumcols ociparse ociplogon ociresult ocirollback ocirowcount ocisavelob ocisavelobfile ociserverversion ocisetprefetch ocistatementtype ociwritelobtofile octdec odbc_autocommit odbc_binmode odbc_close odbc_close_all odbc_columnprivileges odbc_columns odbc_commit odbc_connect odbc_cursor odbc_do odbc_error odbc_errormsg odbc_exec odbc_execute odbc_fetch_array odbc_fetch_into odbc_fetch_object odbc_fetch_row odbc_field_len odbc_field_name odbc_field_num odbc_field_precision odbc_field_scale odbc_field_type odbc_foreignkeys odbc_free_result odbc_gettypeinfo odbc_longreadlen odbc_next_result odbc_num_fields odbc_num_rows odbc_pconnect odbc_prepare odbc_primarykeys odbc_procedurecolumns odbc_procedures odbc_result odbc_result_all odbc_rollback odbc_setoption odbc_specialcolumns odbc_statistics odbc_tableprivileges odbc_tables opendir openlog openssl_csr_export openssl_csr_export_to_file openssl_csr_new openssl_csr_sign openssl_error_string openssl_free_key openssl_get_privatekey openssl_get_publickey openssl_open openssl_pkcs7_decrypt openssl_pkcs7_encrypt openssl_pkcs7_sign openssl_pkcs7_verify openssl_pkey_export openssl_pkey_export_to_file openssl_pkey_new openssl_private_decrypt openssl_private_encrypt openssl_public_decrypt openssl_public_encrypt openssl_seal openssl_sign openssl_verify openssl_x509_check_private_key openssl_x509_checkpurpose openssl_x509_export openssl_x509_export_to_file openssl_x509_free openssl_x509_parse openssl_x509_read ora_bind ora_close ora_columnname ora_columnsize ora_columntype ora_commit ora_commitoff ora_commiton ora_do ora_error ora_errorcode ora_exec ora_fetch ora_fetch_into ora_getcolumn ora_logoff ora_logon ora_numcols ora_numrows ora_open ora_parse ora_plogon ora_rollback ord overload ovrimos_close ovrimos_commit ovrimos_connect ovrimos_cursor ovrimos_exec ovrimos_execute ovrimos_fetch_into ovrimos_fetch_row ovrimos_field_len ovrimos_field_name ovrimos_field_num ovrimos_field_type ovrimos_free_result ovrimos_longreadlen ovrimos_num_fields ovrimos_num_rows ovrimos_prepare ovrimos_result ovrimos_result_all ovrimos_rollback pack parse_ini_file parse_str parse_url passthru pathinfo pclose pcntl_exec pcntl_fork pcntl_signal pcntl_waitpid pcntl_wexitstatus pcntl_wifexited pcntl_wifsignaled pcntl_wifstopped pcntl_wstopsig pcntl_wtermsig pdf_add_annotation pdf_add_bookmark pdf_add_launchlink pdf_add_locallink pdf_add_note pdf_add_outline pdf_add_pdflink pdf_add_thumbnail pdf_add_weblink pdf_arc pdf_arcn pdf_attach_file pdf_begin_page pdf_begin_pattern pdf_begin_template pdf_circle pdf_clip pdf_close pdf_close_image pdf_close_pdi pdf_close_pdi_page pdf_closepath pdf_closepath_fill_stroke pdf_closepath_stroke pdf_concat pdf_continue_text pdf_curveto pdf_delete pdf_end_page pdf_end_pattern pdf_end_template pdf_endpath pdf_fill pdf_fill_stroke pdf_findfont pdf_get_buffer pdf_get_font pdf_get_fontname pdf_get_fontsize pdf_get_image_height pdf_get_image_width pdf_get_majorversion pdf_get_minorversion pdf_get_parameter pdf_get_pdi_value pdf_get_value pdf_initgraphics pdf_lineto pdf_makespotcolor pdf_moveto pdf_new pdf_open pdf_open_ccitt pdf_open_file pdf_open_gif pdf_open_image pdf_open_image_file pdf_open_jpeg pdf_open_memory_image pdf_open_pdi pdf_open_pdi_page pdf_open_png pdf_open_tiff pdf_place_image pdf_place_pdi_page pdf_rect pdf_restore pdf_rotate pdf_save pdf_scale pdf_set_border_color pdf_set_border_dash pdf_set_border_style pdf_set_char_spacing pdf_set_duration pdf_set_font pdf_set_horiz_scaling pdf_set_info pdf_set_info_author pdf_set_info_creator pdf_set_info_keywords pdf_set_info_subject pdf_set_info_title pdf_set_leading pdf_set_parameter pdf_set_text_pos pdf_set_text_rendering pdf_set_text_rise pdf_set_transition pdf_set_value pdf_set_word_spacing pdf_setcolor pdf_setdash pdf_setflat pdf_setfont pdf_setgray pdf_setgray_fill pdf_setgray_stroke pdf_setlinecap pdf_setlinejoin pdf_setlinewidth pdf_setmatrix pdf_setmiterlimit pdf_setpolydash pdf_setrgbcolor pdf_setrgbcolor_fill pdf_setrgbcolor_stroke pdf_show pdf_show_boxed pdf_show_xy pdf_skew pdf_stringwidth pdf_stroke pdf_translate pfpro_cleanup pfpro_init pfpro_process pfpro_process_raw pfpro_version pfsockopen pg_affected_rows pg_cancel_query pg_client_encoding pg_close pg_connect pg_connection_busy pg_connection_reset pg_connection_status pg_copy_from pg_copy_to pg_dbname pg_end_copy pg_escape_bytea pg_escape_string pg_fetch_array pg_fetch_object pg_fetch_result pg_fetch_row pg_field_is_null pg_field_name pg_field_num pg_field_prtlen pg_field_size pg_field_type pg_free_result pg_get_result pg_host pg_last_error pg_last_notice pg_last_oid pg_lo_close pg_lo_create pg_lo_export pg_lo_import pg_lo_open pg_lo_read pg_lo_seek pg_lo_tell pg_lo_unlink pg_lo_write pg_num_fields pg_num_rows pg_options pg_pconnect pg_port pg_put_line pg_query pg_result_error pg_result_status pg_send_query pg_set_client_encoding pg_trace pg_tty pg_untrace php_logo_guid php_sapi_name php_uname phpcredits phpinfo phpversion pi png2wbmp popen pos posix_ctermid posix_getcwd posix_getegid posix_geteuid posix_getgid posix_getgrgid posix_getgrnam posix_getgroups posix_getlogin posix_getpgid posix_getpgrp posix_getpid posix_getppid posix_getpwnam posix_getpwuid posix_getrlimit posix_getsid posix_getuid posix_isatty posix_kill posix_mkfifo posix_setegid posix_seteuid posix_setgid posix_setpgid posix_setsid posix_setuid posix_times posix_ttyname posix_uname pow preg_grep preg_match preg_match_all preg_quote preg_replace preg_replace_callback preg_split prev print_r printer_abort printer_close printer_create_brush printer_create_dc printer_create_font printer_create_pen printer_delete_brush printer_delete_dc printer_delete_font printer_delete_pen printer_draw_bmp printer_draw_chord printer_draw_elipse printer_draw_line printer_draw_pie printer_draw_rectangle printer_draw_roundrect printer_draw_text printer_end_doc printer_end_page printer_get_option printer_list printer_logical_fontheight printer_open printer_select_brush printer_select_font printer_select_pen printer_set_option printer_start_doc printer_start_page printer_write printf pspell_add_to_personal pspell_add_to_session pspell_check pspell_clear_session pspell_config_create pspell_config_ignore pspell_config_mode pspell_config_personal pspell_config_repl pspell_config_runtogether pspell_config_save_repl pspell_new pspell_new_config pspell_new_personal pspell_save_wordlist pspell_store_replacement pspell_suggest putenv qdom_error qdom_tree quoted_printable_decode quotemeta rad2deg rand range rawurldecode rawurlencode read_exif_data readdir readfile readgzfile readline readline_add_history readline_clear_history readline_completion_function readline_info readline_list_history readline_read_history readline_write_history readlink realpath recode recode_file recode_string register_shutdown_function register_tick_function rename require require_once reset restore_error_handler restore_include_path rewind rewinddir rmdir round rsort rtrim sem_acquire sem_get sem_release sem_remove serialize sesam_affected_rows sesam_commit sesam_connect sesam_diagnostic sesam_disconnect sesam_errormsg sesam_execimm sesam_fetch_array sesam_fetch_result sesam_fetch_row sesam_field_array sesam_field_name sesam_free_result sesam_num_fields sesam_query sesam_rollback sesam_seek_row sesam_settransaction session_cache_expire session_cache_limiter session_decode session_destroy session_encode session_get_cookie_params session_id session_is_registered session_module_name session_name session_register session_save_path session_set_cookie_params session_set_save_handler session_start session_unregister session_unset session_write_close set_error_handler set_file_buffer set_include_path set_magic_quotes_runtime set_time_limit setcookie setlocale settype shell_exec shm_attach shm_detach shm_get_var shm_put_var shm_remove shm_remove_var shmop_close shmop_delete shmop_open shmop_read shmop_size shmop_write show_source shuffle similar_text sin sinh sizeof sleep snmp_get_quick_print snmp_set_quick_print snmpget snmprealwalk snmpset snmpwalk snmpwalkoid socket_accept socket_bind socket_close socket_connect socket_create socket_create_listen socket_create_pair socket_fd_alloc socket_fd_clear socket_fd_free socket_fd_isset socket_fd_set socket_fd_zero socket_get_status socket_getopt socket_getpeername socket_getsockname socket_iovec_add socket_iovec_alloc socket_iovec_delete socket_iovec_fetch socket_iovec_free socket_iovec_set socket_last_error socket_listen socket_read socket_readv socket_recv socket_recvfrom socket_recvmsg socket_select socket_send socket_sendmsg socket_sendto socket_set_blocking socket_set_nonblock socket_set_timeout socket_setopt socket_shutdown socket_strerror socket_write socket_writev sort soundex split spliti sprintf sql_regcase sqrt srand sscanf stat str_pad str_repeat str_replace str_rot13 strcasecmp strchr strcmp strcoll strcspn strftime strip_tags stripcslashes stripslashes stristr strlen strnatcasecmp strnatcmp strncasecmp strncmp strpos strrchr strrev strrpos strspn strstr strtok strtolower strtotime strtoupper strtr strval substr substr_count substr_replace swf_actiongeturl swf_actiongotoframe swf_actiongotolabel swf_actionnextframe swf_actionplay swf_actionprevframe swf_actionsettarget swf_actionstop swf_actiontogglequality swf_actionwaitforframe swf_addbuttonrecord swf_addcolor swf_closefile swf_definebitmap swf_definefont swf_defineline swf_definepoly swf_definerect swf_definetext swf_endbutton swf_enddoaction swf_endshape swf_endsymbol swf_fontsize swf_fontslant swf_fonttracking swf_getbitmapinfo swf_getfontinfo swf_getframe swf_labelframe swf_lookat swf_modifyobject swf_mulcolor swf_nextid swf_oncondition swf_openfile swf_ortho swf_ortho2 swf_perspective swf_placeobject swf_polarview swf_popmatrix swf_posround swf_pushmatrix swf_removeobject swf_rotate swf_scale swf_setfont swf_setframe swf_shapearc swf_shapecurveto swf_shapecurveto3 swf_shapefillbitmapclip swf_shapefillbitmaptile swf_shapefilloff swf_shapefillsolid swf_shapelinesolid swf_shapelineto swf_shapemoveto swf_showframe swf_startbutton swf_startdoaction swf_startshape swf_startsymbol swf_textwidth swf_translate swf_viewport swfaction swfbitmap swfbitmap.getheight swfbitmap.getwidth swfbutton swfbutton.addaction swfbutton.addshape swfbutton.setaction swfbutton.setdown swfbutton.sethit swfbutton.setover swfbutton.setup swfbutton_keypress swfdisplayitem swfdisplayitem.addcolor swfdisplayitem.move swfdisplayitem.moveto swfdisplayitem.multcolor swfdisplayitem.remove swfdisplayitem.rotate swfdisplayitem.rotateto swfdisplayitem.scale swfdisplayitem.scaleto swfdisplayitem.setdepth swfdisplayitem.setname swfdisplayitem.setratio swfdisplayitem.skewx swfdisplayitem.skewxto swfdisplayitem.skewy swfdisplayitem.skewyto swffill swffill.moveto swffill.rotateto swffill.scaleto swffill.skewxto swffill.skewyto swffont swffont.getwidth swfgradient swfgradient.addentry swfmorph swfmorph.getshape1 swfmorph.getshape2 swfmovie swfmovie.add swfmovie.nextframe swfmovie.output swfmovie.remove swfmovie.save swfmovie.setbackground swfmovie.setdimension swfmovie.setframes swfmovie.setrate swfmovie.streammp3 swfshape swfshape.addfill swfshape.drawcurve swfshape.drawcurveto swfshape.drawline swfshape.drawlineto swfshape.movepen swfshape.movepento swfshape.setleftfill swfshape.setline swfshape.setrightfill swfsprite swfsprite.add swfsprite.nextframe swfsprite.remove swfsprite.setframes swftext swftext.addstring swftext.getwidth swftext.moveto swftext.setcolor swftext.setfont swftext.setheight swftext.setspacing swftextfield swftextfield.addstring swftextfield.align swftextfield.setbounds swftextfield.setcolor swftextfield.setfont swftextfield.setheight swftextfield.setindentation swftextfield.setleftmargin swftextfield.setlinespacing swftextfield.setmargins swftextfield.setname swftextfield.setrightmargin sybase_affected_rows sybase_close sybase_connect sybase_data_seek sybase_fetch_array sybase_fetch_field sybase_fetch_object sybase_fetch_row sybase_field_seek sybase_free_result sybase_get_last_message sybase_min_client_severity sybase_min_error_severity sybase_min_message_severity sybase_min_server_severity sybase_num_fields sybase_num_rows sybase_pconnect sybase_query sybase_result sybase_select_db symlink syslog system tan tanh tempnam textdomain time tmpfile touch trigger_error trim uasort ucfirst ucwords udm_add_search_limit udm_alloc_agent udm_api_version udm_cat_list udm_cat_path udm_check_charset udm_check_stored udm_clear_search_limits udm_close_stored udm_crc32 udm_errno udm_error udm_find udm_free_agent udm_free_ispell_data udm_free_res udm_get_doc_count udm_get_res_field udm_get_res_param udm_load_ispell_data udm_open_stored udm_set_agent_param uksort umask uniqid unixtojd unlink unpack unregister_tick_function unserialize urldecode urlencode user_error usleep usort utf8_decode utf8_encode var_dump var_export variant version_compare virtual vpo vpopmail_add_alias_domain vpopmail_add_alias_domain_ex vpopmail_add_domain vpopmail_add_domain_ex vpopmail_add_user vpopmail_alias_add vpopmail_alias_del vpopmail_alias_del_domain vpopmail_alias_get vpopmail_alias_get_all vpopmail_auth_user vpopmail_del_domain_ex vpopmail_del_user vpopmail_error vpopmail_passwd vpopmail_set_user_quota vprintf vsprintf w32api_deftype w32api_init_dtype w32api_invoke_function w32api_register_function w32api_set_call_method wddx_add_vars wddx_deserialize wddx_packet_end wddx_packet_start wddx_serialize_value wddx_serialize_vars wordwrap xml_error_string xml_get_current_byte_index xml_get_current_column_number xml_get_current_line_number xml_get_error_code xml_parse xml_parse_into_struct xml_parser_create xml_parser_create_ns xml_parser_free xml_parser_get_option xml_parser_set_option xml_set_character_data_handler xml_set_default_handler xml_set_element_handler xml_set_end_namespace_decl_handler xml_set_external_entity_ref_handler xml_set_notation_decl_handler xml_set_object xml_set_processing_instruction_handler xml_set_start_namespace_decl_handler xml_set_unparsed_entity_decl_handler xmldoc xmldocfile xmlrpc_decode xmlrpc_decode_request xmlrpc_encode xmlrpc_encode_request xmlrpc_get_type xmlrpc_parse_method_descriptions xmlrpc_server_add_introspection_data xmlrpc_server_call_method xmlrpc_server_create xmlrpc_server_destroy xmlrpc_server_register_introspection_callback xmlrpc_server_register_method xmlrpc_set_type xmltree xpath_eval xpath_eval_expression xpath_new_context xptr_eval xptr_new_context xslt_create xslt_errno xslt_error xslt_free xslt_process xslt_set_base xslt_set_encoding xslt_set_error_handler xslt_set_log xslt_set_sax_handler xslt_set_sax_handlers xslt_set_scheme_handler xslt_set_scheme_handlers yaz_addinfo yaz_ccl_conf yaz_ccl_parse yaz_close yaz_connect yaz_database yaz_element yaz_errno yaz_error yaz_hits yaz_itemorder yaz_present yaz_range yaz_record yaz_scan yaz_scan_result yaz_search yaz_sort yaz_syntax yaz_wait yp_all yp_cat yp_err_string yp_errno yp_first yp_get_default_domain yp_master yp_match yp_next yp_order zend_logo_guid zend_version zip_close zip_entry_close zip_entry_compressedsize zip_entry_compressionmethod zip_entry_filesize zip_entry_name zip_entry_open zip_entry_read zip_open zip_read'
		func: 'abs acos acosh addcslashes addslashes array array_change_key_case array_chunk array_combine array_count_values array_diff array_diff_assoc array_diff_key array_diff_uassoc array_diff_ukey array_fill array_filter array_flip array_intersect array_intersect_assoc array_intersect_key array_intersect_uassoc array_intersect_ukey array_key_exists array_keys array_map array_merge array_merge_recursive array_multisort array_pad array_pop array_product array_push array_rand array_reduce array_reverse array_search array_shift array_slice array_splice array_sum array_udiff array_udiff_assoc array_udiff_uassoc array_uintersect array_uintersect_assoc array_uintersect_uassoc array_unique array_unshift array_values array_walk array_walk_recursive atan atan2 atanh base64_decode base64_encode base_convert basename bcadd bccomp bcdiv bcmod bcmul bindec bindtextdomain bzclose bzcompress bzdecompress bzerrno bzerror bzerrstr bzflush bzopen bzread bzwrite ceil chdir checkdate checkdnsrr chgrp chmod chop chown chr chroot chunk_split class_exists closedir closelog copy cos cosh count count_chars date decbin dechex decoct deg2rad delete ebcdic2ascii echo empty end ereg ereg_replace eregi eregi_replace error_log error_reporting escapeshellarg escapeshellcmd eval exec exit exp explode extension_loaded feof fflush fgetc fgetcsv fgets fgetss file_exists file_get_contents file_put_contents fileatime filectime filegroup fileinode filemtime fileowner fileperms filesize filetype floatval flock floor flush fmod fnmatch fopen fpassthru fprintf fputcsv fputs fread fscanf fseek fsockopen fstat ftell ftok getallheaders getcwd getdate getenv gethostbyaddr gethostbyname gethostbynamel getimagesize getlastmod getmxrr getmygid getmyinode getmypid getmyuid getopt getprotobyname getprotobynumber getrandmax getrusage getservbyname getservbyport gettext gettimeofday gettype glob gmdate gmmktime ini_alter ini_get ini_get_all ini_restore ini_set interface_exists intval ip2long is_a is_array is_bool is_callable is_dir is_double is_executable is_file is_finite is_float is_infinite is_int is_integer is_link is_long is_nan is_null is_numeric is_object is_readable is_real is_resource is_scalar is_soap_fault is_string is_subclass_of is_uploaded_file is_writable is_writeable mkdir mktime nl2br parse_ini_file parse_str parse_url passthru pathinfo print printf readlink realpath rewind rewinddir rmdir round str_ireplace str_pad str_repeat str_replace str_rot13 str_shuffle str_split str_word_count strcasecmp strchr strcmp strcoll strcspn strftime strip_tags stripcslashes stripos stripslashes stristr strlen strnatcasecmp strnatcmp strncasecmp strncmp strpbrk strpos strptime strrchr strrev strripos strrpos strspn strstr strtok strtolower strtotime strtoupper strtr strval substr substr_compare'
	}
});

// sql
ssh.addLangRules({
	lang: 'sql',
	alias: 'mysql oracle db2',
	caseSensitive: false,
	rules: {
		comment: ['--', '/* */'],
		keyword: 'ABORT ABS ABSOLUTE ACCESS ADA ADD ADMIN AFTER AGGREGATE ALIAS ALL ALLOCATE ALTER ANALYSE ANALYZE AND ANY ARE AS ASC ASENSITIVE ASSERTION ASSIGNMENT ASYMMETRIC AT ATOMIC AUTHORIZATION AVG BACKWARD BEFORE BEGIN BETWEEN BITVAR BIT_LENGTH BOTH BREADTH BY C CACHE CALL CALLED CARDINALITY CASCADE CASCADED CASE CAST CATALOG CATALOG_NAME CHAIN CHARACTERISTICS CHARACTER_LENGTH CHARACTER_SET_CATALOG CHARACTER_SET_NAME CHARACTER_SET_SCHEMA CHAR_LENGTH CHECK CHECKED CHECKPOINT CLASS CLASS_ORIGIN CLOB CLOSE CLUSTER COALSECE COBOL COLLATE COLLATION COLLATION_CATALOG COLLATION_NAME COLLATION_SCHEMA COLUMN COLUMN_NAME COMMAND_FUNCTION COMMAND_FUNCTION_CODE COMMENT COMMIT COMMITTED COMPLETION CONDITION_NUMBER CONNECT CONNECTION  CONNECTION_NAME CONSTRAINT CONSTRAINTS CONSTRAINT_CATALOG CONSTRAINT_NAME CONSTRAINT_SCHEMA CONSTRUCTOR CONTAINS CONTINUE CONVERSION CONVERT COPY CORRESPONTING COUNT CREATE CREATEDB CREATEUSER CROSS CUBE CURRENT CURRENT_DATE CURRENT_PATH CURRENT_ROLE CURRENT_TIME CURRENT_TIMESTAMP CURRENT_USER CURSOR CURSOR_NAME CYCLE DATA DATABASE DATETIME_INTERVAL_CODE DATETIME_INTERVAL_PRECISION DAY DEALLOCATE DECLARE DEFAULT DEFAULTS DEFERRABLE DEFERRED DEFINED DEFINER DELETE DELIMITER DELIMITERS DEREF DESC DESCRIBE DESCRIPTOR DESTROY DESTRUCTOR DETERMINISTIC DIAGNOSTICS DICTIONARY DISCONNECT DISPATCH DISTINCT DO DOMAIN DROP DYNAMIC DYNAMIC_FUNCTION DYNAMIC_FUNCTION_CODE EACH ELSE ENCODING ENCRYPTED END END-EXEC EQUALS ESCAPE EVERY EXCEPT ESCEPTION EXCLUDING EXCLUSIVE EXEC EXECUTE EXISTING EXISTS EXPLAIN EXTERNAL EXTRACT FALSE FETCH FINAL FIRST FOR FORCE FOREIGN FORTRAN FORWARD FOUND FREE FREEZE FROM FULL FUNCTION G GENERAL GENERATED GET GLOBAL GO GOTO GRANT GRANTED GROUP GROUPING HANDLER HAVING HIERARCHY HOLD HOST IDENTITY IGNORE ILIKE IMMEDIATE IMMUTABLE IMPLEMENTATION IMPLICIT IN INCLUDING INCREMENT INDEX INDITCATOR INFIX INHERITS INITIALIZE INITIALLY INNER INOUT INPUT INSENSITIVE INSERT INSTANTIABLE INSTEAD INTERSECT INTO INVOKER IS ISNULL ISOLATION ITERATE JOIN K KEY KEY_MEMBER KEY_TYPE LANCOMPILER LANGUAGE LARGE LAST LATERAL LEADING LEFT LENGTH LESS LEVEL LIKE LILMIT LISTEN LOAD LOCAL LOCALTIME LOCALTIMESTAMP LOCATION LOCATOR LOCK LOWER M MAP MATCH MAX MAXVALUE MESSAGE_LENGTH MESSAGE_OCTET_LENGTH MESSAGE_TEXT METHOD MIN MINUTE MINVALUE MOD MODE MODIFIES MODIFY MONTH MORE MOVE MUMPS NAMES NATIONAL NATURAL NCHAR NCLOB NEW NEXT NO NOCREATEDB NOCREATEUSER NONE NOT NOTHING NOTIFY NOTNULL NULL NULLABLE NULLIF OBJECT OCTET_LENGTH OF OFF OFFSET OIDS OLD ON ONLY OPEN OPERATION OPERATOR OPTION OPTIONS OR ORDER ORDINALITY OUT OUTER OUTPUT OVERLAPS OVERLAY OVERRIDING OWNER PAD PARAMETER PARAMETERS PARAMETER_MODE PARAMATER_NAME PARAMATER_ORDINAL_POSITION PARAMETER_SPECIFIC_CATALOG PARAMETER_SPECIFIC_NAME PARAMATER_SPECIFIC_SCHEMA PARTIAL PASCAL PENDANT PLACING PLI POSITION POSTFIX PRECISION PREFIX PREORDER PREPARE PRESERVE PRIMARY PRIOR PRIVILEGES PROCEDURAL PROCEDURE PUBLIC READ READS RECHECK RECURSIVE REF REFERENCES REFERENCING REINDEX RELATIVE RENAME REPEATABLE REPLACE RESET RESTART RESTRICT RESULT RETURN RETURNED_LENGTH RETURNED_OCTET_LENGTH RETURNED_SQLSTATE RETURNS REVOKE RIGHT ROLE ROLLBACK ROLLUP ROUTINE ROUTINE_CATALOG ROUTINE_NAME ROUTINE_SCHEMA ROW ROWS ROW_COUNT RULE SAVE_POINT SCALE SCHEMA SCHEMA_NAME SCOPE SCROLL SEARCH SECOND SECURITY SELECT SELF SENSITIVE SERIALIZABLE SERVER_NAME SESSION SESSION_USER SET SETOF SETS SHARE SHOW SIMILAR SIMPLE SIZE SOME SOURCE SPACE SPECIFIC SPECIFICTYPE SPECIFIC_NAME SQL SQLCODE SQLERROR SQLEXCEPTION SQLSTATE SQLWARNINIG STABLE START STATE STATEMENT STATIC STATISTICS STDIN STDOUT STORAGE STRICT STRUCTURE STYPE SUBCLASS_ORIGIN SUBLIST SUBSTRING SUM SYMMETRIC SYSID SYSTEM SYSTEM_USER TABLE TABLE_NAME TEMP TEMPLATE TEMPORARY TERMINATE THAN THEN TIMESTAMP TIMEZONE_HOUR TIMEZONE_MINUTE TO TOAST TRAILING TRANSATION TRANSACTIONS_COMMITTED TRANSACTIONS_ROLLED_BACK TRANSATION_ACTIVE TRANSFORM TRANSFORMS TRANSLATE TRANSLATION TREAT TRIGGER TRIGGER_CATALOG TRIGGER_NAME TRIGGER_SCHEMA TRIM TRUE TRUNCATE TRUSTED TYPE UNCOMMITTED UNDER UNENCRYPTED UNION UNIQUE UNKNOWN UNLISTEN UNNAMED UNNEST UNTIL UPDATE UPPER USAGE USER USER_DEFINED_TYPE_CATALOG USER_DEFINED_TYPE_NAME USER_DEFINED_TYPE_SCHEMA USING VACUUM VALID VALIDATOR VALUES VARIABLE VERBOSE VERSION VIEW VOLATILE WHEN WHENEVER WHERE WITH WITHOUT WORK WRITE YEAR ZONE'
	}
});

// HTML
ssh.addLangRules({
	lang: 'html',
	rules: {
		comment: ['<!-- -->'],
		keyword: 'a abbr acronym address applet area article aside audio b base basefont bdo big blockquote body br button canvas caption center cite code col colgroup command datalist dd del details dfn dir div dl dt em embed fieldset figcaption figure font footer form frame frameset h1 to h6 head header hgroup hr html i iframe img input ins keygen isindex kbd label legend li link map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr tt u ul var video xmp',
		func: 'abbr accept-charset accept accesskey action align alink alt archive axis background bgcolor border cellpadding cellspacing char charoff charset checked cite class classid clear code codebase codetype color cols colspan compact content coords data datetime declare defer dir disabled enctype face for frame frameborder headers height href hreflang hspace http-equiv id ismap label lang language link longdesc marginheight marginwidth maxlength media method multiple name nohref noresize noshade nowrap object onblur onchange onclick ondblclick onfocus onkeydown onkeypress onkeyup onload onmousedown onmousemove onmouseout onmouseover onmouseup onreset onselect onsubmit onunload profile prompt readonly rel rev rows rowspan rules scheme scope scrolling selected shape size span src standby start style summary tabindex target text title type usemap valign value valuetype version vlink vspace width'
	}
});

// CSS
ssh.addLangRules({
	lang: 'css',
	rules: {
		comment: ['/* */'],
		func: 'azimuth background background-attachment background-color background-image background-position background-repeat border border-bottom border-bottom-color border-bottom-style border-bottom-width border-collapse border-color border-left border-left-color border-left-style border-left-width border-right border-right-color border-right-style border-right-width border-spacing border-style border-top border-top-color border-top-style border-top-width border-width bottom caption-side clear clip color content counter-increment counter-reset cue cue-after cue-before cursor direction display elevation empty-cells float font font-face font-family font-size font-size-adjust font-stretch font-style font-variant font-weight height left letter-spacing line-height list-style list-style-image list-style-keyword list-style-position list-style-type margin margin-bottom margin-left margin-right margin-top marker-offset max-height max-width min-height min-width orphans outline outline-color outline-style outline-width overflow padding padding-bottom padding-left padding-right padding-top page page-break-after page-break-before page-break-inside pause pause-after pause-before pitch pitch-range play-during position quotes richness right size speak speak-header speak-numeral speak-punctuation speech-rate stress table-layout text-align text-decoration text-decoration-color text-indent text-shadow text-transform top unicode-bidi vertical-align visibility voice-family volume white-space widows width word-spacing z-index konq_bgpos_x konq_bgpos_y unicode-range units-per-em src panose-1 stemv stemh slope cap-height x-height ascent descent widths bbox definition-src baseline centerline mathline topline !important'
	}
});