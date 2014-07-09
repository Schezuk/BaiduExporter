// ==UserScript==
// @name            百度网盘aria2导出工具
// @author          acgotaku311
// @description 一个方便吧百度网盘的Aria2rpc导出的脚本。
// @encoding           utf-8
// @include     http://*n.baidu.com/s/*
// @include     http://*n.baidu.com/disk/home*
// @include     http://*n.baidu.com/share/link*
// @include     https://*n.baidu.com/s/*
// @include     https://*n.baidu.com/disk/home*
// @include     https://*n.baidu.com/share/link*
// @run-at       document-end
// @version 0.0.1
// ==/UserScript==
var baidu = function(cookies) {
    var version = "0.0.1";
    var thedate_update = "2014/07/01";
    var baidupan = (function() {
        //封装的百度的Toast提示消息
        //Type类型有
        //MODE_CAUTION  警告  MODE_FAILURE  失败  MODE_LOADING 加载 MODE_SUCCESS 成功
        var SetMessage = function(msg, type) {
            var Toast = require("common:widget/toast/toast.js");
            Toast.obtain.useToast({
                toastMode: Toast.obtain[type],
                msg: msg,
                sticky: false
            });
        };
        //重新封装的XMLHttpRequest 用来代替$.ajax 因为百度网盘的$.ajax已经被修改了
        var HttpSendRead = function(info) {
            var http = new XMLHttpRequest();
            var contentType = "\u0061\u0070\u0070\u006c\u0069\u0063\u0061\u0074\u0069\u006f\u006e\u002f\u0078\u002d\u0077\u0077\u0077\u002d\u0066\u006f\u0072\u006d\u002d\u0075\u0072\u006c\u0065\u006e\u0063\u006f\u0064\u0065\u0064\u003b\u0020\u0063\u0068\u0061\u0072\u0073\u0065\u0074\u003d\u0055\u0054\u0046\u002d\u0038";
            var timeout = 3000;
            var deferred = jQuery.Deferred();
            if (info.contentType != null) {
                contentType = info.contentType;
            }
            if (info.timeout != null) {
                timeout = info.timeout;
            }
            var timeId = setTimeout(httpclose, timeout);
            function httpclose() {
                http.abort();
            }
            deferred.promise(http);
            http.onreadystatechange = function() {
                if (http.readyState == 4) {
                    if ((http.status == 200 && http.status < 300) || http.status == 304) {
                        clearTimeout(timeId);
                        if (info.dataType == "json") {
                            deferred.resolve(JSON.parse(http.responseText), http.status, http);
                        }
                        else if (info.dataType == "SCRIPT") {
                            eval(http.responseText);
                            deferred.resolve(http.responseText, http.status, http);
                        }
                    }
                    else {
                        clearTimeout(timeId);
                        deferred.reject(http.status, http, http.statusText);
                    }
                }
            }

            http.open(info.type, info.url, true);
            http.setRequestHeader("Content-type", contentType);
            for (h in info.headers) {
                if (info.headers[h]) {
                    http.setRequestHeader(h, info.headers[h]);
                }
            }
            if (info.type == "POST") {
                http.send(info.data);
            }
            else {
                http.send();
            }
            return http;
        };
        //设置aria2c下载设置的Header信息
        var combination = {
            header: function(cookies) {
                var addheader = [];
                var UA = "netdisk;4.4.0.6;PC;PC-Windows;6.2.9200;WindowsBaiduYunGuanJia";
                addheader.push("User-Agent: " + UA);
                addheader.push("Cookie: " + cookies);
                addheader.push("Referer: " + "http://pan.baidu.com/disk/home");
                return addheader;
            }
        };
        var auth = null; //是否设置用户名密码验证 设置的话变为auth赋值
        var File = require("common:widget/data-center/data-center.js");
        var file_list = []; //储存选中的文件信息包含link和name
        //设置RPC PATH
        var url = (localStorage.getItem("rpc_url") || "http://localhost:6800/jsonrpc") + "?tm=" + (new Date().getTime().toString());
        //设置将要执行的下载方式
        var func = "aria2_data";
        return {
            //初始化按钮和一些事件
            init: function() {
                var self = this;
                var aria2_btn = $("<span>").addClass("icon-btn-device").append($("<span>").text("导出下载").addClass("text").before($("<span>").addClass("ico")).after($("<span>").addClass("ico-more")));
                var list = $("<div>").addClass("menu").attr("id", "aria2_list").appendTo(aria2_btn);
                var aria2_export = $("<a>").text("ARIA2 RPC").appendTo(list);
                var aria2_download = $("<a>").text("ARIA2导出").attr("id", "aria2_download").appendTo(list);
                var config = $("<a>").text("设置").appendTo(list);
                $(".icon-btn-device").after(aria2_btn);
                aria2_btn.mouseover(function() {
                    list.show();
                })
                        .mouseout(function() {
                            list.hide();
                        });
                aria2_export.click(function() {
                    func = "aria2_rpc";
                    self.get_dlink();
                });
                self.set_config_ui();
                self.aria2_download();
                config.click(function() {
                    $("#setting_div").show();
                    self.set_config();
                });
                SetMessage("初始化成功!", "MODE_SUCCESS");
            },
            //获取选择的文件的link和name
            get_info: function(data) {
                var self = this;
                var Filename = File.get("selectedItemList");
                var obj = $.parseJSON(data);
                var name = null;
                var length = obj.dlink.length;
                for (var i = 0; i < length; i++) {
                    for (var j = 0; j < length; j++) {
                        if (obj.dlink[i].fs_id == Filename[j].attr("data-id")) {
                            name = Filename[j].children().eq(0).children().eq(2).attr("title");
                            break;
                        }
                    }
                    file_list.push({"name": name, "link": obj.dlink[i].dlink});
                }

                self[func]();
            },
            //获取文件夹下载的信息 暂时不能使用
            get_dir:function(data){
                var self = this;
                var obj = $.parseJSON(data);
                file_list.push({"name": "pack.zip", "link": obj.dlink});
                console.log(file_list);
                self[func]();
            },
            //设置界面的UI
            set_config_ui: function() {
                var self = this;
                var setting_div = document.createElement("div");
                setting_div.className = "b-panel b-dialog download-mgr-dialog";
                setting_div.id = "setting_div";
                var html_ = [];
                html_.push('<div class="dlg-hd b-rlv"><div title="\u5173\u95ed" id="setting_div_close" class="dlg-cnr dlg-cnr-r"></div><h3>\u5bfc\u51fa\u8bbe\u7f6e</h3></div></div>');
                html_.push('<div style="height:420px;">');
                html_.push('<div id="setting_div_more_settings_but" style="width:60px; border:1px solid #F0F0F0; background-color: #FAFAFA; margin-top: -19px; margin-right: 15px; float:right; text-align:center;"><a href="javascript:;">更多设置</a></div>');
                html_.push('<div style="margin-left: 15px; margin-right: 15px; margin-top: 25px; margin-bottom: 5px;">');
                html_.push('<div id="setting_divtopmsg" style="position:absolute; margin-top: -20px; margin-left: 10px; color: #E15F00;"></div>');
                html_.push('<div style="border:1px solid rgb(240, 240, 240); background-color: rgb(250, 250, 250);">');
                html_.push('<div id="setting_div_table">');
                html_.push('<table id="setting_div_table_1" width="100%" border="0"  style="border-collapse:separate; border-spacing:10px; display:table;">');
                html_.push('<tr>');
                html_.push('<td width="150"><label for="textfield">ARIA2 RPC\uff1a\u0020</label></td>');
                html_.push('<td width="320"><input id="rpc_input" type="text" style="width:90%; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">RPC\u8bbf\u95ee\u8bbe\u7f6e</label></td>');
                html_.push('<td><input id="rpc_distinguish" type="checkbox"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">RPC \u7528\u6237\u540d\uff1a\u0020</label></td>');
                html_.push('<td><input type="text" id="rpc_user" disabled="disabled" style="width:150px; background-color:#eee; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">RPC \u5bc6\u7801\uff1a\u0020</label></td>');
                html_.push('<td><input type="text" id="rpc_pass" disabled="disabled" style="width:150px; background-color:#eee; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"/>');
                html_.push('<div style="position:absolute; margin-top: -20px; right: 20px;"><a id="send_test" type=0 href="javascript:;" style="display:inline-block; border:1px solid #D1D1D1; background-color: #F7F7F7; text-align: center; text-decoration: none; color:#1B83EB;">\u6d4b\u8bd5\u8fde\u63a5\uff0c\u6210\u529f\u663e\u793a\u7248\u672c\u53f7\u3002</a></div></td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2"><div style="color: #656565;">\u76f8\u5173\u8bbe\u7f6e</div><li class="b-list-item separator-1"></li></td>');
                html_.push('</tr><tr>');
                html_.push('<td>\u4e0b\u8f7d\u76ee\u5f55\uff1a\u0020</td><td><input id="down_dir" type="text" style="width:280px; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td>\u6839\u636e\u7f51\u76d8\u8def\u5f84\u5b58\u653e\u6587\u4ef6</td><td><input id="web_path_save" type="checkbox"/></td>');
                html_.push('</tr><tr>');
                html_.push('<!-- <td>增加115网盘支持</td><td><input id="add_115" type="checkbox" style="vertical-align:text-bottom;"/>(现在只有一个导出按钮，还没有设置面板，设置项通用。)</td> -->');
                html_.push('<td>\u5bf9\u6587\u4ef6\u5939\u4f7f\u7528\u007a\u0069\u0070\u4e0b\u8f7d</td><td><input id="dirzip" type="checkbox" style="vertical-align:text-bottom;"/>\u0028\u53ea\u5bf9\u5206\u4eab\u94fe\u63a5\u6709\u6548\u3002\u0029</td>');
                html_.push('</tr><tr>');
                html_.push('<td>\u4f7f\u7528\u8fdc\u7a0b\u7684\u004a\u0053\u811a\u672c</td><td><input id="iswebjs" type="checkbox" style="vertical-align:text-bottom;"/>\u0028\u597d\u5904\u662f\u80fd\u591f\u4fdd\u6301\u6700\u65b0\u7684\u72b6\u6001\u3002\u0029</td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2"><div style="color: #656565;">\u5bfc\u51fa\u7c7b\u578b\u8bbe\u7f6e</div><li class="b-list-item separator-1"></li></td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2" id="typeout">');
                html_.push('<div style="width:80px; float:left; margin-left:30px;"><input id="aria2rpc_checkbox" type="checkbox" disabled="disabled" checked="checked" style="vertical-align:text-bottom;"/><label for="textfield">ARIA2 RPC</label></div>');
                html_.push('<div style="width:70px; float:left; margin-left:50px;"><input id="aria2_checkbox" type="checkbox" style="vertical-align:text-bottom;"/><label for="textfield">ARIA2</label></div>');
                html_.push('<div style="width:70px; float:left; margin-left:50px;"><input id="wget_checkbox" type="checkbox" style="vertical-align:text-bottom;"/><label for="textfield">WGET</label></div>');
                html_.push('<div style="width:70px; float:left; margin-left:50px;"><input id="idm_checkbox" type="checkbox" style="vertical-align:text-bottom;"/><label for="textfield">IDM</label></div>');
                html_.push('</td></tr><tr>');
                html_.push('</table>');
                html_.push('<table id="setting_div_table_2" width="100%" border="0" style="border-collapse:separate; border-spacing:10px; display:none;">');
                html_.push('<tr>');
                html_.push('<td width="50"><label for="textfield"></label></td>');
                html_.push('<td width="320"><label for="textfield"></label></td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2"><div style="color: #656565;">User-Agent</div><li class="b-list-item separator-1"></li></td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2" id="setting_aria2_useragent">');
                html_.push('<a href="javascript:;" onclick=\'javascript:headers_.set_UA("chrome");\'><b>Chrome</b></a>');
                html_.push('<a href="javascript:;" onclick=\'javascript:headers_.set_UA("firefox");\'><b>Firefox</b></a>');
                html_.push('<a href="javascript:;" onclick=\'javascript:headers_.set_UA("exe");\'>云管家</a>');
                html_.push('<a href="javascript:;" onclick=\'javascript:document.getElementById("setting_aria2_useragent_input").removeAttribute("disabled");\'>自定义</a>');
                html_.push('</td>')
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">User-Agent :</label></td>');
                html_.push('<td><input type="text" id="setting_aria2_useragent_input" disabled="disabled" style="width:90%; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2"><div style="color: #656565;">Referer</div><li class="b-list-item separator-1"></li></td>');
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">Referer\u0020\uff1a\u0020</label></td>');
                html_.push('<td><input type="text" id="setting_aria2_referer_input" style="width:90%; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">自动设置</label></td>');
                html_.push('<td><input id=referer_auto type="checkbox"/></td>');
                html_.push('</tr><tr>');
                html_.push('<td colspan="2"><div style="color: #656565;">Headers<label for="textfield" style="margin-left: 35px;">※使用回车分隔每个headers。</label></div><li class="b-list-item separator-1"></li></td>');
                html_.push('</tr><tr>');
                html_.push('<td><label for="textfield">headers\u0020\uff1a\u0020</label></td>');
                html_.push('<td><textarea id="setting_aria2_headers" style="overflow:auto; resize:none; width:90%; height:80px; border: 1px solid #C6C6C6; box-shadow: 0 0 3px #C6C6C6; -webkit-box-shadow: 0 0 3px #C6C6C6;"></textarea></td>');
                html_.push('</tr>');
                html_.push('</table>');
                html_.push('</div>');
                html_.push('</div>');
                html_.push('<div style="margin-top:10px;">');
                html_.push('<div style="margin-left:77.5%;"><a href="javascript:;" id="apply" style="display:inline-block; width:120px; height:30px; border:1px solid #D1D1D1; background-color: #F7F7F7; text-align: center; text-decoration: none; padding-top:7px; color:#1B83EB;"><b>\u5e94\u7528</b></a></div>');
                html_.push('</div></div></div>');
                setting_div.innerHTML = html_.join("");
                document.body.appendChild(setting_div);
                $("#setting_div_close").click(function() {
                    $("#setting_div").hide();
                });
                $("#apply").click(function() {
                    self.get_config();
                    $("#setting_divtopmsg").html("设置已保存,目前只能设置RPC路径和用户名密码.");
                });
                $("#send_test").click(function() {
                    self.get_version();
                });
                $("#setting_div_more_settings_but").click(function() {
                    if ($("#setting_div_table_2").css("display") != "none") {
                        $("#setting_div_table_1").css("display", "table");
                        $("#setting_div_table_2").css("display", "none");
                        $("#setting_div_more_settings_but a").html("更多设置");
                    }
                    else {
                        $("#setting_div_table_1").css("display", "none");
                        $("#setting_div_table_2").css("display", "table");
                        $("#setting_div_more_settings_but a").html("返回");
                    }
                });
                $("#rpc_distinguish").change(function() {
                    if ($(this).is(":checked")) {
                        $("#rpc_user").removeAttr("disabled").css("background-color", "#FFF");
                        $("#rpc_pass").removeAttr("disabled").css("background-color", "#FFF");
                    } else {
                        $("#rpc_user").attr({"disabled": "disabled"}).css("background-color", "#eee");
                        $("#rpc_pass").attr({"disabled": "disabled"}).css("background-color", "#eee");
                    }
                })


            },
            //aria2导出下载界面以及事件绑定
            aria2_download: function() {
                var download_ui = $("<div>").attr("id", "download_ui").addClass("b-panel b-dialog add-yun-device-dialog common-dialog").append('<div class="dlg-hd b-rlv"><span class="dlg-cnr dlg-cnr-l"></span><a href="javascript:;" title="关闭" id="aria2_download_close" class="dlg-cnr dlg-cnr-r"></a><h3><em></em>ARIA2导出</h3></div>');
                var content_ui = $("<div>").addClass("dlg-bd global-clearfix __dlgBd").attr("id", "content_ui").appendTo(download_ui);
                download_ui.appendTo($("body"));
                var self = this;
                $("#aria2_download").click(function() {
                    func = "aria2_data";
                    self.get_dlink();
                });
                $("#aria2_download_close").click(function() {
                    download_ui.hide();
                });
            },
            //导出填充数据和显示数据
            aria2_data: function() {
                var files = [];
                if (file_list.length > 0) {
                    var length = file_list.length;
                    for (var i = 0; i < length; i++) {
                        files.push("aria2c -c -s10 -x10 -o " + JSON.stringify(file_list[i].name) + " --header " + JSON.stringify(combination.header(cookies)[1]) + " " + JSON.stringify(file_list[i].link));
                    }
                    $("#content_ui").empty();
                    var download_link = $("<textarea>").css({"white-space": "nowrap", "width": "100%", "overflow": "scroll", "height": "180px"}).val(files.join("\n"));
                    download_link.appendTo($("#content_ui"));
                    $("#download_ui").show();
                }

            },
            //填充已经设置的配置数据
            set_config:function(){
                 $("#rpc_input").val((localStorage.getItem("rpc_url") || "http://localhost:6800/jsonrpc"));
                if (localStorage.getItem("auth") == "true") {
                    var rpc_user = localStorage.getItem("rpc_user");
                    var rpc_pass = localStorage.getItem("rpc_pass");
                    $("#rpc_user").val(rpc_user);
                    $("#rpc_pass").val(rpc_pass);
                    $("#rpc_distinguish").prop('checked',true).trigger("change");
                    auth = "Basic " + btoa(rpc_user + ":" + rpc_pass);
                }
                else{
                    $("#rpc_user").val("");
                    $("#rpc_pass").val("");
                }
            },
            //保存配置数据
            get_config: function() {
                var rpc_url = $("#rpc_input").val();
                if (rpc_url!="") {
                    localStorage.setItem("rpc_url", rpc_url);
                    url = rpc_url + "?tm=" + (new Date().getTime().toString());
                }
                if ($("#rpc_distinguish").prop('checked')==true) {
                    localStorage.setItem("rpc_user", $("#rpc_user").attr("value"));
                    localStorage.setItem("rpc_pass", $("#rpc_pass").attr("value"));
                    localStorage.setItem("auth", true);
                    auth = "Basic " + btoa($("#rpc_user").attr("value") + ":" + $("#rpc_pass").attr("value"));
                } else {
                    localStorage.setItem("auth", false);
                    localStorage.setItem("rpc_user", null);
                    localStorage.setItem("rpc_pass", null);
                }
            },
            //获取选中文件的下载链接
            get_dlink: function(func) {
                var self = this;
                var Service = require("common:widget/commonService/commonService.js");
                var Filename = File.get("selectedItemList");
                var length=Filename.length;
                file_list.length = 0;
                for(var i=0;i<length;i++){
                    if(Filename[i].attr("data-extname")=="dir"){
                        Service.getDlink(JSON.stringify(File.get("selectedList")), "batch", self.get_dir.bind(self));
                        return ;
                    }
                }
                Service.getDlink(JSON.stringify(File.get("selectedList")), "dlink", self.get_info.bind(self));
            },
            //获取aria2c的版本号用来测试通信
            get_version: function() {
                var data = [{
                        "jsonrpc": "2.0",
                        "method": "aria2.getVersion",
                        "id": 1
                    }];
                var parameter={'url': url, 'dataType': 'json', type: 'POST', data: JSON.stringify(data), 'headers': {'Authorization': auth}};
                HttpSendRead(parameter)
                        .done(function(xml, textStatus, jqXHR) {
                            console.log(jqXHR);
                            $("#send_test").html("ARIA2\u7248\u672c\u4e3a\uff1a\u0020" + xml[0].result.version);
                        })
                        .fail(function(jqXHR, textStatus, errorThrown) {
                            $("#send_test").html(textStatus + "\u9519\u8BEF\uFF0C\u70B9\u51FB\u91CD\u65B0\u6D4B\u8BD5");
                        });
            },
            //封装rpc要发送的数据
            aria2_rpc: function() {
                var self = this;
                if (file_list.length > 0) {
                    var length = file_list.length;
                    for (var i = 0; i < length; i++) {
                        var rpc_data = [{
                                "jsonrpc": "2.0",
                                "method": "aria2.addUri",
                                "id": new Date().getTime(),
                                "params": [[file_list[i].link], {
                                        "out": file_list[i].name,
                                        "header": combination.header(cookies)
                                    }
                                ]
                            }];
                        self.aria2send_data(rpc_data);
                    }
                }
            },
            //和aria2c通信
            aria2send_data: function(data) {
                var parameter={'url': url, 'dataType': 'json', type: 'POST', data: JSON.stringify(data), 'headers': {'Authorization': auth}};
                HttpSendRead(parameter)
                        .done(function(json, textStatus, jqXHR) {
                            SetMessage("下载成功!赶紧去看看吧~", "MODE_SUCCESS");

                        })
                        .fail(function(jqXHR, textStatus, errorThrown) {
                            SetMessage("下载失败!是不是没有开启aria2?", "MODE_FAILURE");
                        });
            }
        }
    })();
    baidupan.init();
};
function onload(func) {
    if (document.readyState === "complete") {
        func();
    } else {
        window.addEventListener('load', func);
    }
}
//通过background.js获取到 name 为BDUSS的cookie
chrome.runtime.sendMessage({do: "get_cookie"}, function(response) {
    if (response) {
        var cookies = response.cookie;
    } else {
        location.reload(true);
    }
    onload(function() {
        //把函数注入到页面中
        var script = document.createElement('script');
        script.id = "baidu_script";
        script.appendChild(document.createTextNode('(' + baidu + ')("' + cookies + '");'));
        (document.body || document.head || document.documentElement).appendChild(script);
    });
});


