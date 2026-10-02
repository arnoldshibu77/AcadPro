// AcadPro - Content Script (Optimized for College Web Portals & Rajagiri SMS)
(function () {
  if (window.hasAcadProInjected || window.hasAutoFeedbackProInjected) return;
  window.hasAcadProInjected = true;
  window.hasAutoFeedbackProInjected = true;

  // Listen for messages from Popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_AUTOFILL") {
      const stats = runAutofill(request.settings);
      sendResponse({ success: true, stats: stats });
    }
    return true;
  });

  // Keyword rating match tables
  const sentimentKeywords = {
    excellent: [
      'excellent', 'strongly agree', 'outstanding', 'very good', 'always', 'exceeds', 'far exceeds', 
      '5', '5 star', 'star 5', 'grade a', 'highly satisfied', 'best', '100%', 'more than 90%', 
      'more than 95%', 'above 90%', 'yes'
    ],
    good: [
      'good', 'agree', 'above average', 'frequently', 'meets expectations', '4', '4 star', 
      'star 4', 'grade b', 'satisfied', '90 to 95%', '80 to 90%', 'more than 95% but less than 100%'
    ],
    neutral: [
      'neutral', 'average', 'moderate', 'sometimes', '3', '3 star', 'star 3', 'grade c', 
      'neither agree nor disagree', 'partially satisfied', 'fair', 'partially', '70 to 80%', '60 to 70%'
    ],
    poor: [
      'poor', 'very poor', 'disagree', 'strongly disagree', 'bad', 'below average', 'rarely', 
      'never', '1', '2', 'unsatisfied', 'needs improvement', 'no', 'less than 60%', 
      'less than 80%', 'course plan not yet given'
    ]
  };

  const smartCommentDatabase = {
    strengthWeakness: [
      "Strength: Excellent domain knowledge, clear explanations, and friendly approach. Weakness: None.",
      "Strength: Interactive teaching style and prompt doubt resolution. Weakness: No major weaknesses observed."
    ],
    remarks: [
      "Overall teaching delivery was highly effective and satisfactory.",
      "No negative remarks. Enjoyed learning this course."
    ],
    teaching: [
      "The teacher explains concepts thoroughly with clear practical illustrations.",
      "Very structured teaching methodology and great course coverage."
    ],
    infrastructure: [
      "Classroom facilities and equipment are well maintained.",
      "Good infrastructure and clean learning environment provided."
    ],
    general: [
      "Overall academic experience has been very good and satisfactory.",
      "Prompt support and clear guidance received throughout the term."
    ]
  };

  function runAutofill(settings) {
    let radioCount = 0;
    let selectCount = 0;
    let commentCount = 0;

    const fillOptions = settings.fillOptions !== false;
    const fillComments = settings.fillComments !== false;

    // 1. Process Radio Buttons
    if (fillOptions) {
      radioCount = processRadioGroups(settings.ratingMode);
      selectCount = processSelectDropdowns(settings.ratingMode);
      const starCount = processCustomStarRatings(settings.ratingMode);
      radioCount += starCount;
    }

    // 2. Process Text Comment Boxes
    if (fillComments) {
      commentCount = processTextComments(settings);
    }

    // Show Toast Summary on Web Page
    showToastNotification(`Autofilled ${radioCount} option choices & ${commentCount} comment/remark fields!`);

    // 3. Handle Auto Submit / Next Button if enabled
    if (settings.autoSubmit) {
      triggerAutoSubmitOrNext(3);
    }

    return { radioCount, selectCount, commentCount };
  }

  // --- Radio Group Handling ---
  function processRadioGroups(ratingMode) {
    let count = 0;
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    if (radios.length === 0) return 0;

    const radioGroups = new Map();

    radios.forEach(radio => {
      let groupKey = radio.name;
      const parentRow = radio.closest('tr, .question-row, .form-group, li, table tr');
      
      if (!groupKey || groupKey === 'radio' || groupKey === 'option') {
        groupKey = parentRow ? parentRow : radio.getAttribute('aria-label') || 'unnamed_group_' + Math.random();
      }

      if (!radioGroups.has(groupKey)) {
        radioGroups.set(groupKey, []);
      }
      radioGroups.get(groupKey).push(radio);
    });

    radioGroups.forEach((groupRadios) => {
      if (groupRadios.length === 0) return;

      const scoredRadios = groupRadios.map(radio => {
        const textToAnalyze = getElementTextContext(radio);
        const score = calculateSentimentScore(textToAnalyze, radio.value);
        return { radio, score };
      });

      scoredRadios.sort((a, b) => b.score - a.score);

      let targetRadio = null;

      if (ratingMode === 'excellent') {
        targetRadio = scoredRadios[0]?.radio;
      } else if (ratingMode === 'good') {
        targetRadio = scoredRadios.length > 1 ? scoredRadios[1]?.radio : scoredRadios[0]?.radio;
      } else if (ratingMode === 'neutral') {
        const midIndex = Math.floor(scoredRadios.length / 2);
        targetRadio = scoredRadios[midIndex]?.radio;
      } else if (ratingMode === 'varied') {
        const pickIndex = (Math.random() < 0.8 || scoredRadios.length === 1) ? 0 : 1;
        targetRadio = scoredRadios[pickIndex]?.radio || scoredRadios[0]?.radio;
      }

      if (targetRadio) {
        clickAndTriggerEvents(targetRadio);
        count++;
      }
    });

    return count;
  }

  // --- Select Dropdowns Handling ---
  function processSelectDropdowns(ratingMode) {
    let count = 0;
    const selects = document.querySelectorAll('select');

    selects.forEach(select => {
      const options = Array.from(select.options).filter(opt => opt.value !== "" && !opt.disabled);
      if (options.length === 0) return;

      const scoredOptions = options.map(opt => {
        const textToAnalyze = opt.textContent + " " + opt.value;
        const score = calculateSentimentScore(textToAnalyze, opt.value);
        return { opt, score };
      });

      scoredOptions.sort((a, b) => b.score - a.score);

      let targetOpt = null;
      if (ratingMode === 'excellent') {
        targetOpt = scoredOptions[0]?.opt;
      } else if (ratingMode === 'good') {
        targetOpt = scoredOptions.length > 1 ? scoredOptions[1]?.opt : scoredOptions[0]?.opt;
      } else if (ratingMode === 'neutral') {
        const midIndex = Math.floor(scoredOptions.length / 2);
        targetOpt = scoredOptions[midIndex]?.opt;
      } else if (ratingMode === 'varied') {
        const pickIndex = (Math.random() < 0.8 || scoredOptions.length === 1) ? 0 : 1;
        targetOpt = scoredOptions[pickIndex]?.opt || scoredOptions[0]?.opt;
      }

      if (targetOpt) {
        select.value = targetOpt.value;
        dispatchFormEvents(select);
        count++;
      }
    });

    return count;
  }

  // --- Custom Star Ratings ---
  function processCustomStarRatings(ratingMode) {
    let count = 0;
    const ratingContainers = document.querySelectorAll('.rating, .stars, .star-rating, [data-rating], .rating-group');

    ratingContainers.forEach(container => {
      const stars = Array.from(container.querySelectorAll('span, i, svg, button, a, [role="radio"]'));
      if (stars.length === 0) return;

      let targetStar = null;
      if (ratingMode === 'excellent' || ratingMode === 'varied') {
        targetStar = stars[stars.length - 1];
      } else if (ratingMode === 'good') {
        targetStar = stars.length > 1 ? stars[stars.length - 2] : stars[stars.length - 1];
      } else {
        targetStar = stars[Math.floor(stars.length / 2)];
      }

      if (targetStar) {
        clickAndTriggerEvents(targetStar);
        count++;
      }
    });

    return count;
  }

  // --- Written Feedback & Remarks Fields ---
  function processTextComments(settings) {
    let count = 0;
    const textElements = document.querySelectorAll('textarea, input[type="text"]:not([name*="name"]):not([name*="email"]):not([name*="roll"]):not([name*="id"]):not([name*="date"]):not([name*="search"]):not([id*="search"])');

    const presets = (settings.presetComments && settings.presetComments.length > 0)
      ? settings.presetComments
      : [
          "The teaching methodology is excellent and concepts are explained clearly.",
          "Approachability of faculty and guidance during sessions is commendable.",
          "Very structured course delivery and prompt query resolution."
        ];

    let presetIndex = 0;

    textElements.forEach(el => {
      if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.type !== 'text') return;

      let commentText = "";

      if (settings.commentMode === 'custom' && settings.customComment) {
        commentText = settings.customComment;
      } else if (settings.commentMode === 'smart') {
        commentText = generateSmartComment(el);
      } else {
        const contextText = getQuestionTextForInput(el).toLowerCase();
        
        if (contextText.includes('strength') || contextText.includes('weakness')) {
          commentText = getRandomArrayItem(smartCommentDatabase.strengthWeakness);
        } else if (contextText.includes('remark')) {
          commentText = getRandomArrayItem(smartCommentDatabase.remarks);
        } else {
          commentText = presets[presetIndex % presets.length];
          presetIndex++;
        }
      }

      el.value = commentText;
      dispatchFormEvents(el);
      count++;
    });

    return count;
  }

  function getQuestionTextForInput(element) {
    const parentRow = element.closest('tr, .form-group, .question-container, td, div');
    if (!parentRow) return "";
    
    const prevTd = parentRow.querySelector('td:first-child, .q-text, label');
    if (prevTd) return prevTd.textContent;

    return parentRow.textContent || "";
  }

  function generateSmartComment(element) {
    const labelText = getQuestionTextForInput(element).toLowerCase();

    if (labelText.includes('strength') || labelText.includes('weakness')) {
      return getRandomArrayItem(smartCommentDatabase.strengthWeakness);
    }
    if (labelText.includes('remark')) {
      return getRandomArrayItem(smartCommentDatabase.remarks);
    }
    if (labelText.includes('teach') || labelText.includes('faculty') || labelText.includes('lecturer')) {
      return getRandomArrayItem(smartCommentDatabase.teaching);
    }
    if (labelText.includes('infra') || labelText.includes('class') || labelText.includes('lab')) {
      return getRandomArrayItem(smartCommentDatabase.infrastructure);
    }

    return getRandomArrayItem(smartCommentDatabase.general);
  }

  function getRandomArrayItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function calculateSentimentScore(text, value) {
    const combined = (text + " " + (value || "")).toLowerCase();
    let score = 0;

    sentimentKeywords.excellent.forEach(kw => {
      if (combined.includes(kw)) score += 50;
    });
    sentimentKeywords.good.forEach(kw => {
      if (combined.includes(kw)) score += 30;
    });
    sentimentKeywords.neutral.forEach(kw => {
      if (combined.includes(kw)) score += 10;
    });
    sentimentKeywords.poor.forEach(kw => {
      if (combined.includes(kw)) score -= 50;
    });

    const num = parseFloat(value);
    if (!isNaN(num)) {
      if (num >= 4) score += num * 10;
      else if (num === 3) score += 10;
      else score -= 30;
    }

    return score;
  }

  function getElementTextContext(el) {
    let text = "";

    const parentTd = el.closest('td, th, li, label, div');
    if (parentTd) text += parentTd.textContent + " ";

    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) text += label.textContent + " ";
    }

    if (el.getAttribute('aria-label')) text += el.getAttribute('aria-label') + " ";
    if (el.value) text += el.value + " ";

    return text;
  }

  function clickAndTriggerEvents(el) {
    el.checked = true;
    el.click();
    dispatchFormEvents(el);
  }

  function dispatchFormEvents(el) {
    ['focus', 'input', 'change', 'blur'].forEach(eventName => {
      const event = new Event(eventName, { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
    });
  }

  let activeCountdownInterval = null;

  function triggerAutoSubmitOrNext(countdownSeconds = 3) {
    const submitSelectors = [
      'input[value*="SUBMIT"]',
      'input[value*="Submit"]',
      'input[value*="NEXT"]',
      'input[value*="Next"]',
      'button[id*="submit"]',
      'input[type="submit"]',
      'button[type="submit"]',
      '#submit',
      '#btnSubmit',
      '.btn-submit'
    ];

    let targetBtn = null;
    for (const selector of submitSelectors) {
      targetBtn = document.querySelector(selector);
      if (targetBtn) break;
    }

    if (!targetBtn) {
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, input[type="image"]'));
      targetBtn = buttons.find(b => {
        const txt = (b.textContent || b.value || "").toUpperCase();
        return txt.includes('SUBMIT') || txt.includes('NEXT') || txt.includes('SAVE');
      });
    }

    if (targetBtn) {
      const actionName = (targetBtn.textContent || targetBtn.value || "").toUpperCase().includes('NEXT') ? 'Proceeding to Next Question' : 'Submitting Feedback Form';
      startSubmissionCountdown(targetBtn, actionName, countdownSeconds);
    } else {
      showToastNotification("Autofill completed! Click Submit/Next when ready.", "success");
    }
  }

  function startSubmissionCountdown(targetBtn, actionName, seconds) {
    if (activeCountdownInterval) clearInterval(activeCountdownInterval);

    let remaining = seconds;

    const buildMsg = (sec) => `${actionName} in <strong style="color: #818cf8; font-size: 13px;">${sec}s</strong>... <a href="#" id="cancelSubmitBtn" style="color: #f87171; font-size: 11px; margin-left: 6px; text-decoration: underline;">Cancel</a>`;

    const toast = showToastNotification(buildMsg(remaining), "info", 5000);

    const bindCancel = () => {
      const cancelBtn = toast ? toast.querySelector('#cancelSubmitBtn') : null;
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (activeCountdownInterval) clearInterval(activeCountdownInterval);
          activeCountdownInterval = null;
          showToastNotification("Auto-submit cancelled by user.", "warning");
        });
      }
    };

    bindCancel();

    activeCountdownInterval = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        const msgSpan = toast ? toast.querySelector('.af-toast-msg') : null;
        if (msgSpan) {
          msgSpan.innerHTML = buildMsg(remaining);
          bindCancel();
        }
      } else {
        if (activeCountdownInterval) clearInterval(activeCountdownInterval);
        activeCountdownInterval = null;
        showToastNotification(`${actionName} now!`, "success");
        setTimeout(() => {
          targetBtn.click();
        }, 200);
      }
    }, 1000);
  }

  function showToastNotification(message, type = "success", duration = 4500) {
    let existingToast = document.getElementById('acadpro-toast') || document.getElementById('autofeedback-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'acadpro-toast';
    toast.className = `af-toast af-toast-${type}`;

    const iconSymbol = type === 'warning' ? '⚠️' : type === 'info' ? '⏳' : '⚡';

    toast.innerHTML = `
      <div class="af-toast-icon">${iconSymbol}</div>
      <div class="af-toast-content">
        <span class="af-toast-title">AcadPro</span>
        <span class="af-toast-msg">${message}</span>
      </div>
      <button class="af-toast-close">&times;</button>
    `;

    document.body.appendChild(toast);

    toast.querySelector('.af-toast-close').addEventListener('click', () => {
      if (activeCountdownInterval) clearInterval(activeCountdownInterval);
      toast.remove();
    });

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, duration);
    }

    return toast;
  }
})();
