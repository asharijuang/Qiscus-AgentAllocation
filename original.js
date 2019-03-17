jQuery(document).ready(function () {
    if ('Notification' in window && Notification.permission !== "granted") Notification.requestPermission();
    var isMinimized = true,
        ls = JSON.parse(localStorage.getItem('qismo-widget'));


    var defaultConfig = {
        "customerServiceAvatar": "https://d1edrlpyc25xu0.cloudfront.net/kiwari-prod/image/upload/Ri-pxHv6e1/default_avatar.png",
        "customerServiceName": "Customer Service",
        "buttonText": "Talk to Us",
        "buttonIcon": null,
        "formGreet": "Welcome to Live Chat",
        "openAtStart": false,
        "welcomeText": "Hallow, how are you. if you need our help don't hesitate to chat with us",
        "welcomeMessageStatus": false,
        "welcomeTimeout":20
    }

    var openAtStart = qismoConfig.openAtStart || defaultConfig.openAtStart;
    var welcomeMessageStatus = qismoConfig.welcomeMessageStatus || defaultConfig.welcomeMessageStatus;
    var loginFormOpened = false;

    // console.log(qismoConfig)
    // console.log(welcomeMessageStatus);
    /**
     * So there's 2 version, local storage based data
     * and global var based data (don't need regist form)
     * we'll check this client used which one first
     */

    var isRegistrationFormNeeded = window.userId ? false : true;
    if(isRegistrationFormNeeded) {
        // registration code here
        if(ls === null || (!ls.user_id && !ls.user_name)) {
            if(welcomeMessageStatus){
                attachWelcomeDialog()
            }
            attachLoginFormToDOM();
        } else {
            // local storage data available, let's login
            initQiscusWidget(ls);
        }
    } else {
        // initiate using global vars, login directly
        initQiscusWidget();
    }

    const defaultInitOptions = {
        loginSuccessCallback: function (userData) {
            if (openAtStart) {
                QiscusSDK.core.UI.chatGroup(window.roomId)
            }
        },
        roomChangedCallback: function (data) {
            qiscus.selected.name = qismoConfig.customerServiceName || defaultConfig.customerServiceName
            qiscus.selected.avatar = qismoConfig.customerServiceAvatar || defaultConfig.customerServiceAvatar
            if ($('.qcw-copyright').length === 0) {
                // code to run if it isn't there
                var copyrightHtml = '<div class="qcw-copyright" style="justify-content: center;font-size: 10px;color: #a3a3a3;text-align: center;display: flex;position: relative;-webkit-box-pack: justify;order: 3;">'+
                'Powered by <a href="https://qiscus.com" target="_blank" style="display:inline-block;margin-left: 3px;color: #a3a3a3;">Qiscus</a>'+
                '</div>';
                $('body .qcw-chat-wrapper').append(copyrightHtml);
            }
        },
        newMessagesCallback: function (data) {
            if ('Notification' in window && Notification.permission !== "granted") showNotif(data);
            // scrolling to bottom
            setTimeout(function () {
                lastCommentId = QiscusSDK.core.selected.comments[QiscusSDK.core.selected.comments.length - 1].id;
                theElement = document.getElementById(lastCommentId);
                theElement.scrollIntoView({ block: 'end', behaviour: 'smooth' })
            }, 200);
            if (data[0].type == 'system_event') {
                
                if (data[0].message.toLowerCase().indexOf('as resolved') > -1) {
                    getAppSession().then(function(res){
                        if(res.data.is_sessional) $('body').toggleClass('resolved-conversation');
                        renderStartNewChat();
                    });
                }

                if (data[0].message.toLowerCase().indexOf('joined this conversation') > -1) {
                    // redirect to chat view
                    renderStartNewChat();
                }
            }
        }
    }
    function getButtonText(){
        if(qismoConfig.buttonHasText && typeof qismoConfig.buttonText === "undefined") {
            return defaultConfig.buttonText;
        }else if(qismoConfig.buttonHasText && qismoConfig.buttonText !== "undefined"){
            return qismoConfig.buttonText;
        }else{
            return "";
        }
    }
    function initQiscusWidget(userData, windowState) {
        var baseURL = qismoConfig.qismoBaseUrl || 'https://qismo-stag.qiscus.com',
            appId = qismoConfig.appID,
            userId = window.userId,
            userName = window.userName,
            // origin = qismoConfig.origin,
            origin = window.location.href,
            roomBadge = qismoConfig.roomBadge,
            avatar = 'https://d1edrlpyc25xu0.cloudfront.net/kiwari-prod/image/upload/wMWsDZP6ta/1516689726-ic_qiscus_client.png';
        if(userData) {
            userId = userData.user_id;
            userName = userData.user_name;
        }
        QiscusSDK.core.init({
            AppId: appId
        })
        QiscusSDK.core.getNonce().then(function(res) {
            // Initiate Room
            if(typeof windowState != "undefined" && windowState === true){
                openAtStart = true;
            }
            var params = {
                'app_id': appId,
                'user_id': userId,
                'name': userName,
                'avatar': avatar,
                'nonce': res.nonce,
                'extras' : JSON.stringify({
                    'timezone_offset' : new Date().getTimezoneOffset() / -60
                })
            }

            if(origin) params.origin = origin;
            if(roomBadge) params.room_badge = roomBadge;

            // debugger
            var initRoom = jQuery.post(baseURL + '/api/v1/qiscus/initiate_chat', params);
            initRoom.done(function (data) {
                jQuery('.qcw-cs-container').removeClass('qcw-cs-container--open');
                jQuery('body').removeClass('resolved-conversation');
                jQuery('.qcw-cs-container').remove();

                window.isSessional = data.data.is_sessional
                window.roomId = data.data.room_id
                var sdkEmail = userId,
                identityToken = data.data.identity_token
                // var password = data.data.sdk_user.password,
                //     sdkEmail = data.data.sdk_user.email
                QiscusSDK.core.init({
                    AppId: appId,
                    options: window.qiscusInitOptions
                        ? Object.assign({}, defaultInitOptions, window.qiscusInitOptions)
                        : defaultInitOptions,
                })

                QiscusSDK.core.verifyIdentityToken(identityToken).then(function(verifyResponse) {
                    QiscusSDK.core.setUserWithIdentityToken(verifyResponse);
                })
                // QiscusSDK.core.setUser(sdkEmail, password, userName, 'https://d1edrlpyc25xu0.cloudfront.net/kiwari-prod/image/upload/wMWsDZP6ta/1516689726-ic_qiscus_client.png')
                QiscusSDK.render()

                QiscusSDK.core.UI.widgetButtonText = getButtonText();

                QiscusSDK.core.UI.widgetButtonIcon = qismoConfig.buttonIcon || defaultConfig.buttonIcon;
            });
        });
    }

    function getAppSession() {
        var baseURL = qismoConfig.qismoBaseUrl || 'https://qismo-stag.qiscus.com';
        return $.get(baseURL + '/' + qismoConfig.appID + '/get_session')
            .done(function(data) {
                if(data.is_sessional) window.isSessional = data.is_sessional;
                return Promise.resolve(data);
            })
            .fail(function(error){
                return Promise.reject(error);
            });
    }
    function renderStartNewChat() {
        if (!window.isSessional || $('.start-new-chat-container').length) return false;
        var html = '<div class="start-new-chat-container">'
            + '<button>Start New Chat</button>'
            + '</div>';
        $('body .qcw-container').append(html);
    }
    jQuery(function () {
        // button live chat sdk
        jQuery('body').on('click', '.qcw-trigger-btn', function () {
            if (isMinimized && !qiscus.selected && window.roomId) {
                QiscusSDK.core.UI.chatGroup(window.roomId);
            }
            isMinimized = !isMinimized;
        });
        jQuery('body').on('click', '.start-new-chat-container button', function() {
            var ls = JSON.parse(localStorage.getItem('qismo-widget'));
            initQiscusWidget(ls, true);
        });
    })
    function showNotif(data) {
        // create the notification if only window is not focused
        if (document.hasFocus()) return

        if (data[0].email === QiscusSDK.core.user_id
            && data[0].room_id == QiscusSDK.core.selected.id) return false;

        const notif = new Notification('you get a chat from ' + data[0].username, {
            icon: data[0].user_avatar,
            body: (data[0].message.startsWith('[file]'))
                ? 'File attached.'
                : data[0].message,
        });
        notif.onclick = function () {
            notif.close();
            window.focus();
        }
    }
    // button form live chat
    function welcomeButtonListener(){
        $('.qcw-cs-trigger-button, .qcw-cs-close').unbind('click')

        $('.qcw-cs-welcome .qcw-cs-close-welcome').unbind('click').on('click', function () {
            loginFormOpened = false;
            $('.qcw-cs-welcome').hide()
        })
    }
    function attachEventListenerChat(){
        if (screen.width > 768) {

            $('.qcw-cs-trigger-button, .qcw-cs-close').on('click', function () {
                $('.qcw-cs-welcome').hide()
                if (jQuery('.qcw-cs-container--open').length > 0) {
                    loginFormOpened = false;
                    jQuery('.qcw-cs-container').removeClass('qcw-cs-container--open')
                } else {
                    loginFormOpened = true;
                    jQuery('.qcw-cs-container').addClass('qcw-cs-container--open')
                }
            })
        } else {
            $('.qcw-cs-trigger-button, .qcw-cs-close').on('click', function () {
                $('.qcw-cs-welcome').hide()
                if (jQuery('.qcw-cs-container--open').length > 0) {
                    loginFormOpened = false;
                    jQuery('.qcw-cs-container').removeClass('qcw-cs-container--open')
                    jQuery('body').removeClass('--modalOpen')
                    document.ontouchmove = function (event) {

                    }
                } else {
                    loginFormOpened = true;
                    jQuery('.qcw-cs-container').addClass('qcw-cs-container--open')
                    jQuery('body').addClass('--modalOpen')
                    document.ontouchmove = function (event) {
                        event.preventDefault();
                    }
                }
            })
        }
    }

    function attachWelcomeDialog(){
        var welcomeText = qismoConfig.welcomeText || defaultConfig.welcomeText
        var welcomeCustomerServiceName = qismoConfig.customerServiceName || defaultConfig.customerServiceName
        var welcomeAvatarUrl = qismoConfig.customerServiceAvatar || defaultConfig.customerServiceAvatar

        if(welcomeMessageStatus){
            var welcomeContainer = jQuery('<div class="qcw-cs-welcome ">' +
                '<div class="qcw-header">'+
                    '<div class="qcw-header-avatar">'+
                        '<img src="'+ welcomeAvatarUrl + '">'+
                    '</div>'+
                    '<div class="qcw-user-display-name">' + welcomeCustomerServiceName +'</div>'+
                    '<span class="qcw-cs-close-welcome">&#x268A;</span>' +
                '</div>'+
                '<div class="qcw-welcome-text">'+
                    welcomeText+
                '</div>'+
            '</div>')

            var timeout = qismoConfig.welcomeTimeout >=0 ? qismoConfig.welcomeTimeout : defaultConfig.welcomeTimeout;

            setTimeout(function(){
                if(!loginFormOpened) {
                    welcomeContainer.prependTo('body');
                    welcomeButtonListener();
                    attachEventListenerChat();
                }
            }, parseInt(timeout)*1000)
        }

    }

    function attachLoginFormToDOM() {
        var buttonText = getButtonText();
        var buttonIcon = qismoConfig.buttonIcon || defaultConfig.buttonIcon
        var greet = qismoConfig.formGreet || defaultConfig.formGreet

        if(buttonIcon){
            var img = '<img src="'+ buttonIcon +'">'
        }else{
            var img = ''
        }

        if(buttonText){
            var text = '<div>'+ buttonText +'</div>'
        }else{
            var text = ''
        }

        var chatForm = jQuery('<div class="qcw-cs-container">' +
            '<div class="qcw-cs-wrapper">' +
                '<span class="qcw-cs-close">&#x268A;</span>' +
                '<div class="qcw-cs-box-form">' +
                    '<h3>' + greet + '</h3>' +
                    '<p>Please fill the details below before chatting with us</p>' +
                    '<form>' +
                        '<div class="qcw-cs-form-group">' +
                            '<input type="name" name="name" class="qcw-cs-form-field" id="inputname" placeholder="Name">' +
                        '</div>' +
                        '<div class="qcw-cs-form-group">' +
                            '<input type="email" name="email" class="qcw-cs-form-field" id="inputEmail" placeholder="Email">' +
                        '</div>' +
                        '<div class="qcw-cs-form-group">' +
                            '<button name="submitform" type="submit" class="qcw-cs-submit-form">Submit</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
            '</div>' +
            '<div class="qcw-trigger-btn qcw-cs-trigger-button">'+
                img +
                text+
            '</div>'+
        '</div>')
        chatForm.prependTo('body');
        attachEventListenerChat()
        if(openAtStart && !welcomeMessageStatus){
            loginFormOpened = true;
            $('.qcw-cs-trigger-button').click()
        }

        jQuery('.qcw-cs-wrapper form').on('submit', function (e) {
            e.preventDefault();
            var _self = jQuery(this),
                submitBtn = jQuery('button[name="submitform"]'),
                randomKey = Date.now(),
                userData = {
                    user_id: jQuery('#inputEmail').val(),
                    user_name: jQuery('#inputname').val()
                }

            if (!userData.user_id || !userData.user_name) {
                if (jQuery('.qcw-cs-form-group.error').length === 0) {
                    jQuery('<div class="qcw-cs-form-group error"><span>All fields are required!</span></div>').prependTo(_self);
                }
                return
            } else {
                jQuery('.qcw-cs-form-group.error').remove();
            }
            submitBtn.attr('type', 'button')
            submitBtn.prop('disabled', '')
            newUser = true
            // initQiscusWidget(userData.user_id, userData.user_name, userData.user_name, newUser)
            jQuery('.qcw-cs-box-form').remove()
            attachConsultationFormToDOM(userData);
        });
    }

    function attachConsultationFormToDOM(userData) {
        var buttonText = getButtonText();
        var buttonIcon = qismoConfig.buttonIcon || defaultConfig.buttonIcon
        var greet = qismoConfig.formGreet || defaultConfig.formGreet

        if(buttonIcon){
            var img = '<img src="'+ buttonIcon +'">'
        }else{
            var img = ''
        }

        if(buttonText){
            var text = '<div>'+ buttonText +'</div>'
        }else{
            var text = ''
        }

        var chatForm = jQuery(
                '<span class="qcw-cs-close">&#x268A;</span>' +
                '<div class="qcw-cs-box-form">' +
                    '<h3>Request Consultation</h3>' +
                    '<p>Apa yang ingin di diskusikan</p>' +
                    '<form>' +
                        '<div class="qcw-cs-form-group">' +
                            '<input type="text" name="keluhan" class="qcw-cs-form-field" id="inputkeluhan" placeholder="Tulis keluhan">' +
                        '</div>' +
                        '<div class="qcw-cs-form-group">' +
                            '<button name="submitform" type="submit" class="qcw-cs-submit-form">Mulai Konsultasi</button>' +
                        '</div>' +
                    '</form>' +
                '</div>')
        chatForm.prependTo('.qcw-cs-wrapper');
        attachEventListenerChat()
        if(openAtStart && !welcomeMessageStatus){
            loginFormOpened = true;
            $('.qcw-cs-trigger-button').click()
        }

        jQuery('.qcw-cs-wrapper form').on('submit', function (e) {
            e.preventDefault();
            var _self = jQuery(this),
                submitBtn = jQuery('button[name="submitform"]'),
                randomKey = Date.now(),
                consultationData = {
                    user_id: userData.user_id,
                    user_name: userData.user_name,
                    keluhan : jQuery('#inputkeluhan').val()
                }
            if (!consultationData.keluhan) {
                if (jQuery('.qcw-cs-form-group.error').length === 0) {
                    jQuery('<div class="qcw-cs-form-group error"><span>Keluhan tidak boleh kosong!</span></div>').prependTo(_self);
                }
                return
            } else {
                jQuery('.qcw-cs-form-group.error').remove();
            }
            submitBtn.attr('type', 'button')
            submitBtn.prop('disabled', '')
            submitBtn.html('Loading...')
            newUser = true
            localStorage.setItem('qismo-widget', JSON.stringify(consultationData))
            initQiscusWidget(consultationData,true);
        });
    }
});
