/* ============================================================
   HSK1 Luyện Tập — shared JS helpers (新HSK教程1 学练手册)
   Dùng trong các file lessons/*.html
   - HSK.initTabs()   : hiện đúng section (Nghe/Đọc/Viết) theo #hash
   - HSK.Quiz(...)     : engine dựng câu hỏi trắc nghiệm + tự chấm điểm
   ============================================================ */
window.HSK = (function(){

  function el(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  /* ---------- Ảnh linh hoạt định dạng file: nếu đuôi mặc định (đuôi đầu
     tiên trong src của thẻ <img>) không load được, tự thử lần lượt các
     đuôi file khác trước khi ẩn hẳn ảnh (data-base giữ đường dẫn KHÔNG có
     đuôi, ví dụ "images/bai1/A"). Đặt .webp lên đầu vì đó là đuôi thật
     đang dùng (ảnh nhẹ) — tránh tốn request thừa làm ảnh hiện chậm. Mỗi
     trang HTML nên để đúng đuôi thật ở thẻ <img> gốc, đuôi còn lại trong
     danh sách chỉ là lưới an toàn khi đổi định dạng sau này. ---------- */
  const IMG_EXTS = ['webp','png','jpg','jpeg','WEBP','PNG','JPG','JPEG'];
  function imgFallback(img){
    const base = img.dataset.base;
    if(!base){ img.style.display = 'none'; return; }
    const idx = parseInt(img.dataset.extIdx || '0', 10) + 1;
    if(idx >= IMG_EXTS.length){ img.style.display = 'none'; return; }
    img.dataset.extIdx = idx;
    img.src = base + '.' + IMG_EXTS[idx];
  }

  /* ---------- Tab switching (Nghe / Đọc / Viết) driven by location.hash ---------- */
  function initTabs(defaultTab){
    const sections = Array.from(document.querySelectorAll('.tab-section'));
    function show(){
      const tab = (location.hash || '#' + defaultTab).replace('#','');
      let found = false;
      sections.forEach(sec=>{
        const match = sec.dataset.tab === tab;
        sec.classList.toggle('active', match);
        if(match) found = true;
      });
      if(!found && sections.length){
        sections.forEach((sec,i)=>sec.classList.toggle('active', i===0));
      }
    }
    window.addEventListener('hashchange', show);
    show();
  }

  /* ---------- Quiz engine ---------- */
  function Quiz(opts){
    this.scoreTxtId  = opts.scoreTxtId;
    this.gradeBtnId  = opts.gradeBtnId;
    this.resetBtnId  = opts.resetBtnId;
    this.answers = {};
    this.questions = []; // {n, ans}
    this.graded = false;
  }

  Quiz.prototype.makeOptBtn = function(qn, letter, label){
    const self = this;
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.type = 'button';
    btn.dataset.q = qn;
    btn.dataset.letter = letter;
    btn.textContent = label ? (letter + ' ' + label) : letter;
    btn.addEventListener('click', function(){
      if(self.graded) return;
      self.answers[qn] = letter;
      document.querySelectorAll('.opt-btn[data-q="'+qn+'"]').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      self.updateLabel();
    });
    return btn;
  };

  Quiz.prototype.registerQuestion = function(n, ans, type){
    this.questions.push({n:n, ans:ans, type: type || 'choice'});
  };

  Quiz.prototype.updateLabel = function(){
    if(this.graded || !this.scoreTxtId) return;
    const answered = this.questions.filter(q=>{
      if(q.type === 'text'){
        const input = document.querySelector('.text-input[data-q="'+q.n+'"]');
        return input && input.value.trim().length > 0;
      }
      return !!this.answers[q.n];
    }).length;
    const elx = document.getElementById(this.scoreTxtId);
    if(elx) elx.textContent = 'Đã làm ' + answered + ' / ' + this.questions.length + ' câu';
  };

  /* Render a "write the character for this pinyin" fill-in row (single correct answer). */
  Quiz.prototype.mountHanzi = function(containerEl, n, questionHtml, pinyin, answerChar){
    const self = this;
    this.registerQuestion(n, answerChar, 'text');
    const row = el('<div class="q-row" style="flex-direction:column;align-items:stretch;">'+
      '<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">'+
        '<div class="q-num">'+n+'.</div>'+
        '<div class="q-text">'+questionHtml+'</div>'+
        '<span class="pinyin-tag">'+pinyin+'</span>'+
        '<input type="text" class="text-input" data-q="'+n+'" maxlength="4" placeholder="汉字">'+
      '</div></div>');
    const input = row.querySelector('.text-input');
    input.addEventListener('input', ()=>{ if(!self.graded) self.updateLabel(); });
    const exp = document.createElement('div');
    exp.className = 'explain';
    exp.id = 'exp-' + n;
    exp.innerHTML = 'Đáp án: <b>'+answerChar+'</b>';
    row.appendChild(exp);
    containerEl.appendChild(row);
  };

  /* Render a "match the sentence" style question row.
     optionsDict: {A:'...', B:'...', ...}  answerLetter: correct key */
  Quiz.prototype.mountMatch = function(containerEl, n, questionText, optionsDict, answerLetter){
    this.registerQuestion(n, answerLetter);
    const row = el('<div class="q-row" style="flex-direction:column;align-items:stretch;">'+
      '<div style="display:flex;gap:10px;"><div class="q-num">'+n+'.</div><div class="q-text">'+questionText+'</div></div>'+
      '</div>');
    const grp = document.createElement('div');
    grp.className = 'opt-group';
    grp.style.marginLeft = '36px';
    Object.keys(optionsDict).forEach(letter=>grp.appendChild(this.makeOptBtn(n, letter)));
    row.appendChild(grp);
    const exp = document.createElement('div');
    exp.className = 'explain';
    exp.id = 'exp-' + n;
    exp.innerHTML = 'Đáp án: <b>'+answerLetter+'</b> — “'+optionsDict[answerLetter]+'”';
    row.appendChild(exp);
    containerEl.appendChild(row);
  };

  /* Render a "fill in the blank / word bank" style question row.
     optionsDict: {A:'像', B:'以为', ...} */
  Quiz.prototype.mountFillBlank = function(containerEl, n, questionText, optionsDict, answerLetter){
    this.registerQuestion(n, answerLetter);
    const row = el('<div class="q-row" style="flex-direction:column;align-items:stretch;">'+
      '<div style="display:flex;gap:10px;"><div class="q-num">'+n+'.</div><div class="q-text">'+questionText+'</div></div>'+
      '</div>');
    const grp = document.createElement('div');
    grp.className = 'opt-group';
    grp.style.marginLeft = '36px';
    Object.keys(optionsDict).forEach(letter=>grp.appendChild(this.makeOptBtn(n, letter, optionsDict[letter])));
    row.appendChild(grp);
    const exp = document.createElement('div');
    exp.className = 'explain';
    exp.id = 'exp-' + n;
    exp.innerHTML = 'Đáp án: <b>'+answerLetter+' '+optionsDict[answerLetter]+'</b>';
    row.appendChild(exp);
    containerEl.appendChild(row);
  };

  /* Render a passage + multiple choice block.
     passageHtml can be null to omit (e.g. shares passage with previous block) */
  Quiz.prototype.mountMCQBlock = function(containerEl, n, passageHtml, starText, optionsDict, answerLetter){
    this.registerQuestion(n, answerLetter);
    const block = document.createElement('div');
    block.className = 'q-row';
    block.style.flexDirection = 'column';
    block.style.alignItems = 'stretch';
    if(passageHtml){
      const p = document.createElement('div');
      p.className = 'passage';
      p.innerHTML = passageHtml;
      block.appendChild(p);
    }
    const star = document.createElement('div');
    star.className = 'star-q';
    star.innerHTML = '<span class="star-q-num">'+n+'.</span>' + starText;
    block.appendChild(star);
    const grp = document.createElement('div');
    grp.className = 'opt-group';
    Object.keys(optionsDict).forEach(letter=>grp.appendChild(this.makeOptBtn(n, letter, optionsDict[letter])));
    block.appendChild(grp);
    const exp = document.createElement('div');
    exp.className = 'explain';
    exp.id = 'exp-' + n;
    exp.style.paddingLeft = '0';
    exp.innerHTML = 'Đáp án: <b>'+answerLetter+' '+optionsDict[answerLetter]+'</b>';
    block.appendChild(exp);
    containerEl.appendChild(block);
    return block; // caller can append more star-q/opt-group into it for shared-passage items
  };

  /* For questions that literally share one passage block already on the page
     (e.g. 23~24), use this to add just the star+options+explain into an existing wrapper. */
  Quiz.prototype.appendMCQToBlock = function(blockEl, n, starText, optionsDict, answerLetter){
    this.registerQuestion(n, answerLetter);
    const star = document.createElement('div');
    star.className = 'star-q';
    star.innerHTML = '<span class="star-q-num">'+n+'.</span>' + starText;
    blockEl.appendChild(star);
    const grp = document.createElement('div');
    grp.className = 'opt-group';
    Object.keys(optionsDict).forEach(letter=>grp.appendChild(this.makeOptBtn(n, letter, optionsDict[letter])));
    blockEl.appendChild(grp);
    const exp = document.createElement('div');
    exp.className = 'explain';
    exp.id = 'exp-' + n;
    exp.style.paddingLeft = '0';
    exp.innerHTML = 'Đáp án: <b>'+answerLetter+' '+optionsDict[answerLetter]+'</b>';
    blockEl.appendChild(exp);
  };

  Quiz.prototype.grade = function(){
    this.graded = true;
    let correct = 0;
    const self = this;
    this.questions.forEach(function(q){
      if(q.type === 'text'){
        const input = document.querySelector('.text-input[data-q="'+q.n+'"]');
        const val = input ? input.value.trim() : '';
        if(input){
          input.disabled = true;
          input.classList.remove('correct','wrong');
          input.classList.add(val === q.ans ? 'correct' : 'wrong');
        }
        if(val === q.ans) correct++;
      } else {
        const chosen = self.answers[q.n];
        document.querySelectorAll('.opt-btn[data-q="'+q.n+'"]').forEach(function(btn){
          btn.classList.add('locked');
          const letter = btn.dataset.letter;
          if(letter === q.ans){
            btn.classList.add('correct');
          } else if(letter === chosen && chosen !== q.ans){
            btn.classList.add('wrong');
          }
        });
        if(chosen === q.ans) correct++;
      }
      const exp = document.getElementById('exp-'+q.n);
      if(exp) exp.classList.add('show');
    });
    if(this.scoreTxtId){
      const elx = document.getElementById(this.scoreTxtId);
      if(elx) elx.textContent = 'Kết quả: ' + correct + ' / ' + this.questions.length + ' câu đúng 🎉';
    }
    return correct;
  };

  Quiz.prototype.reset = function(){
    /* Chỉ xoá các câu của CHÍNH quiz này (trang HSK1 có nhiều phần chấm
       độc lập trên cùng 1 trang, không được xoá nhầm phần khác). */
    this.graded = false;
    this.answers = {};
    this.questions.forEach(function(q){
      document.querySelectorAll('.opt-btn[data-q="'+q.n+'"]').forEach(function(btn){
        if(!btn.classList.contains('disabled')) btn.classList.remove('selected','correct','wrong','locked');
      });
      document.querySelectorAll('.text-input[data-q="'+q.n+'"]').forEach(function(input){
        input.disabled = false; input.value = ''; input.classList.remove('correct','wrong');
      });
      const exp = document.getElementById('exp-'+q.n);
      if(exp) exp.classList.remove('show');
    });
    if(this.scoreTxtId){
      const elx = document.getElementById(this.scoreTxtId);
      if(elx) elx.textContent = '0 / ' + this.questions.length + ' câu';
    }
  };

  /* Snapshot of current state for saving/printing results — does NOT force
     grading. If already graded (this.graded), also includes per-question
     correct/wrong + total correct count. */
  Quiz.prototype.getSummary = function(){
    const self = this;
    const answers = {};
    const answerKey = {};
    this.questions.forEach(function(q){
      answerKey[q.n] = q.ans;
      if(q.type === 'text'){
        const input = document.querySelector('.text-input[data-q="'+q.n+'"]');
        answers[q.n] = input ? input.value.trim() : '';
      } else {
        answers[q.n] = self.answers[q.n] || '';
      }
    });
    let correct = null;
    if(this.graded){
      correct = 0;
      this.questions.forEach(function(q){
        if(answers[q.n] === q.ans) correct++;
      });
    }
    return { total: this.questions.length, graded: this.graded, correct: correct, answers: answers, answerKey: answerKey };
  };

  Quiz.prototype.bindButtons = function(){
    const self = this;
    if(this.gradeBtnId){
      const g = document.getElementById(this.gradeBtnId);
      if(g) g.addEventListener('click', ()=>self.grade());
    }
    if(this.resetBtnId){
      const r = document.getElementById(this.resetBtnId);
      if(r) r.addEventListener('click', ()=>self.reset());
    }
    this.updateLabel();
  };

  /* Render an open-ended "look at the picture, write a sentence with this word" block.
     Not auto-graded (many valid answers) — gives a textarea + a reveal-on-demand sample
     answer. imgBase = đường dẫn ảnh KHÔNG có đuôi (vd "images/bai1/28") — ảnh thật thay
     cho mô tả chữ, dùng chung cơ chế tự thử đuôi file với HSK.imgFallback. */
  function mountSentenceWriting(containerEl, n, imgBase, word, sampleAnswer){
    const block = el('<div class="q-row" style="flex-direction:column;align-items:stretch;">'+
      '<div class="q-num">'+n+'.</div>'+
      '<div class="writing-row">'+
        '<img class="writing-pic" src="'+imgBase+'.webp" data-base="'+imgBase+'" alt="Câu '+n+'" onerror="HSK.imgFallback(this)">'+
        '<div class="writing-right">'+
          '<span class="word-tag">'+word+'</span>'+
          '<textarea class="writing-textarea" data-q="'+n+'" data-sample="'+sampleAnswer+'" placeholder="Viết câu của bạn ở đây…"></textarea>'+
        '</div>'+
      '</div>'+
      '<div><button type="button" class="reveal-btn">Xem câu ví dụ</button></div>'+
      '<div class="sample-answer">Câu ví dụ tham khảo: <b>'+sampleAnswer+'</b></div>'+
      '</div>');
    const btn = block.querySelector('.reveal-btn');
    const sample = block.querySelector('.sample-answer');
    btn.addEventListener('click', ()=>{
      sample.classList.toggle('show');
      btn.textContent = sample.classList.contains('show') ? 'Ẩn câu ví dụ' : 'Xem câu ví dụ';
    });
    containerEl.appendChild(block);
  }

  /* ---------- Chọn đáp án cho phần Nghe — tô cam nút đang chọn trong cùng
     1 câu, giống 1 nhóm radio (dùng cho việc đánh dấu lựa chọn, kể cả khi
     không/chưa có đáp án gốc để chấm). Dùng event delegation nên gọi 1 lần
     trên container cha là đủ, không cần gọi lại khi thêm câu hỏi mới vào
     sau. ---------- */
  function bindSingleSelect(container){
    if(!container) return;
    container.addEventListener('click', function(e){
      const btn = e.target.closest('.opt-btn');
      if(!btn || !container.contains(btn)) return;
      const group = btn.closest('.opt-group');
      if(!group) return;
      group.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  }

  /* ---------- Đọc file đáp án dạng "1C\n2B\n3A\n..." (số câu dính liền
     1 chữ cái, mỗi câu 1 dòng) thành object {1:'C', 2:'B', ...}. Dòng nào
     không đúng định dạng bị bỏ qua thay vì gây lỗi. ---------- */
  function parseAnswerKey(text){
    const dict = {};
    String(text || '').split(/\r?\n/).forEach(function(line){
      const m = line.trim().match(/^(\d+)\s*([A-Za-z])$/);
      if(m) dict[m[1]] = m[2].toUpperCase();
    });
    return dict;
  }

  /* ---------- Gắn chấm điểm cho phần Nghe khi ĐÃ có file đáp án gốc
     (audio/baiN/dap_an_nghe_baiN.txt). Khác với HSK.Quiz (tự dựng DOM câu
     hỏi), hàm này CHẤM ĐIỂM TRÊN DOM CÓ SẴN — các nút .opt-btn của phần
     Nghe đã được trang bai*.html tự dựng sẵn với data-q/data-letter, hàm
     này chỉ cần gắn thêm hành vi chọn (bindSingleSelect) + chấm/làm lại.
     answersDict = null/undefined nghĩa là CHƯA có đáp án gốc — vẫn cho
     chọn đáp án bình thường (để đánh dấu), chỉ ẩn thanh chấm điểm.
     opts: {questionNums:[1..10], scoreBarId, scoreTxtId, gradeBtnId, resetBtnId} */
  function mountListeningQuiz(scopeSelector, answersDict, opts){
    const container = document.querySelector(scopeSelector);
    if(!container) return null;
    bindSingleSelect(container);

    const questionNums = opts.questionNums || [];
    const hasKey = !!(answersDict && Object.keys(answersDict).length);
    let graded = false;

    const scoreBar = opts.scoreBarId ? document.getElementById(opts.scoreBarId) : null;
    const scoreTxt = opts.scoreTxtId ? document.getElementById(opts.scoreTxtId) : null;
    const gradeBtn = opts.gradeBtnId ? document.getElementById(opts.gradeBtnId) : null;
    const resetBtn = opts.resetBtnId ? document.getElementById(opts.resetBtnId) : null;

    if(hasKey && scoreBar) scoreBar.style.display = '';

    function updateLabel(){
      if(graded || !scoreTxt) return;
      const answered = questionNums.filter(function(n){
        return container.querySelector('.opt-btn.selected[data-q="'+n+'"]');
      }).length;
      scoreTxt.textContent = 'Đã làm ' + answered + ' / ' + questionNums.length + ' câu';
    }
    container.addEventListener('click', function(e){
      if(e.target.closest('.opt-btn')) updateLabel();
    });

    function grade(){
      if(!hasKey) return null;
      graded = true;
      let correct = 0;
      questionNums.forEach(function(n){
        const ans = answersDict[n];
        const chosenBtn = container.querySelector('.opt-btn.selected[data-q="'+n+'"]');
        const chosen = chosenBtn ? chosenBtn.dataset.letter : null;
        container.querySelectorAll('.opt-btn[data-q="'+n+'"]').forEach(function(btn){
          btn.classList.add('locked');
          if(btn.dataset.letter === ans) btn.classList.add('correct');
          else if(btn === chosenBtn && chosen !== ans) btn.classList.add('wrong');
        });
        if(chosen === ans) correct++;
      });
      if(scoreTxt) scoreTxt.textContent = 'Kết quả: ' + correct + ' / ' + questionNums.length + ' câu đúng 🎉';
      return correct;
    }

    function reset(){
      graded = false;
      container.querySelectorAll('.opt-btn').forEach(function(b){
        b.classList.remove('selected','correct','wrong','locked');
      });
      updateLabel();
    }

    if(gradeBtn) gradeBtn.addEventListener('click', grade);
    if(resetBtn) resetBtn.addEventListener('click', reset);
    updateLabel();

    function getSummary(){
      const answers = {};
      questionNums.forEach(function(n){
        const chosenBtn = container.querySelector('.opt-btn.selected[data-q="'+n+'"]');
        answers[n] = chosenBtn ? chosenBtn.dataset.letter : '';
      });
      let correct = null;
      if(graded){
        correct = 0;
        questionNums.forEach(function(n){ if(hasKey && answers[n] === answersDict[n]) correct++; });
      }
      return { total: questionNums.length, graded: graded, correct: correct, answers: answers, answerKey: hasKey ? answersDict : {} };
    }

    return { grade: grade, reset: reset, getSummary: getSummary, hasKey: hasKey };
  }

  /* ---------- Phát âm bằng giọng đọc của trình duyệt (Text-to-Speech,
     tiếng Trung zh-CN). Dùng cho thẻ từ: bấm vào là nghe. Máy nào không
     có giọng tiếng Trung thì bỏ qua, không báo lỗi. Đây chỉ là trợ giúp —
     audio gốc của sách (audio/baiN/*.mp3) vẫn là chuẩn. ---------- */
  let zhVoice = null;
  function pickVoice(){
    if(!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices() || [];
    zhVoice = voices.find(v=>/zh[-_]CN/i.test(v.lang)) || voices.find(v=>/^zh/i.test(v.lang)) || null;
  }
  if('speechSynthesis' in window){
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text){
    if(!('speechSynthesis' in window) || !text) return;
    try{
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.8;
      if(zhVoice) u.voice = zhVoice;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }

  /* ---------- Pinyin: đặt dấu thanh lên đúng nguyên âm chính.
     Quy tắc: có a/e thì đặt lên a/e; có "ou" thì đặt lên o; còn lại đặt
     lên nguyên âm cuối cùng (vd: gui → guǐ, liu → liú). tone = 1..4,
     0/5 = thanh nhẹ (không dấu). ---------- */
  const TONE_MARKS = {
    a:['a','ā','á','ǎ','à'], e:['e','ē','é','ě','è'], i:['i','ī','í','ǐ','ì'],
    o:['o','ō','ó','ǒ','ò'], u:['u','ū','ú','ǔ','ù'], 'ü':['ü','ǖ','ǘ','ǚ','ǜ']
  };
  function addTone(syllable, tone){
    const s = String(syllable || '').replace(/v/g,'ü');
    tone = parseInt(tone,10) || 0;
    if(tone < 1 || tone > 4) return s;
    let idx = -1;
    if(s.indexOf('a') >= 0) idx = s.indexOf('a');
    else if(s.indexOf('e') >= 0) idx = s.indexOf('e');
    else if(s.indexOf('ou') >= 0) idx = s.indexOf('o');
    else {
      for(let i=s.length-1;i>=0;i--){ if(TONE_MARKS[s[i]]){ idx = i; break; } }
    }
    if(idx < 0) return s;
    return s.slice(0,idx) + TONE_MARKS[s[idx]][tone] + s.slice(idx+1);
  }
  /* Bỏ dấu thanh + chuẩn hoá để so khớp đáp án gõ tay: chữ thường, bỏ
     khoảng trắng, "v" coi như "ü". ignoreTones = true thì so cả khi học
     viên gõ có/không dấu thanh. */
  function normPinyin(s, ignoreTones){
    let t = String(s || '').trim().toLowerCase().replace(/\s+/g,'').replace(/v/g,'ü').replace(/u:/g,'ü');
    if(ignoreTones){
      t = t.replace(/ü/g,'\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0001/g,'ü');
    }
    return t.normalize('NFC');
  }

  /* ---------- Đọc file đáp án dạng "mã câu + khoảng trắng + đáp án",
     ví dụ:
        2-1 b
        3-4 ang
        4-1 3
     Dòng trống / dòng bắt đầu bằng # bị bỏ qua. Trả về {"2-1":"b", ...}. */
  function parseKeyFile(text){
    const dict = {};
    String(text || '').split(/\r?\n/).forEach(function(line){
      line = line.trim();
      if(!line || line[0] === '#') return;
      const m = line.match(/^([0-9]+-[0-9]+)\s*[:=\s]\s*(.+)$/);
      if(m) dict[m[1]] = m[2].trim();
    });
    return dict;
  }

  /* ---------- KeyedQuiz — chấm điểm cho các dạng bài HSK1 trên DOM có sẵn,
     mỗi câu có mã "bài-câu" (vd "2-5"):
       type 'text'   : ô nhập  <input class="key-input" data-q="2-5">
       type 'tone'   : nhóm nút chọn thanh <div class="tone-pick" data-q="4-1">
       type 'choice' : nhóm nút .opt-btn[data-q][data-letter]
       type 'select' : danh sách thả xuống <select class="key-select" data-q="2-5">
     Câu nào CHƯA có đáp án trong key thì vẫn làm được, chỉ không tính điểm.
     opts: {scope, scoreBarId, scoreTxtId, gradeBtnId, resetBtnId, noteId} */
  function KeyedQuiz(opts){
    this.opts = opts || {};
    this.scope = document.querySelector(this.opts.scope) || document;
    this.items = [];     // {id, type, ignoreTones, display}
    this.key = {};
    this.graded = false;
  }
  KeyedQuiz.prototype.add = function(id, type, extra){
    this.items.push(Object.assign({id:id, type:type}, extra || {}));
  };
  KeyedQuiz.prototype.setKey = function(dict){
    const self = this;
    this.key = {};
    Object.keys(dict || {}).forEach(function(id){
      const it = self.items.find(x=>x.id === id);
      if(!it) return;
      let v = String(dict[id]).trim();
      if(it.type === 'tone' && /^[0-5]$/.test(v)) v = addTone(it.base, v);
      self.key[id] = v;
    });
    this.updateLabel();
  };
  KeyedQuiz.prototype.keyedItems = function(){
    const self = this;
    return this.items.filter(it=>self.key[it.id] != null && self.key[it.id] !== '');
  };
  KeyedQuiz.prototype.getAnswer = function(it){
    const q = '[data-q="'+it.id+'"]';
    if(it.type === 'text'){
      const inp = this.scope.querySelector('.key-input'+q);
      return inp ? inp.value.trim() : '';
    }
    if(it.type === 'select'){
      const sel = this.scope.querySelector('.key-select'+q);
      return sel ? sel.value : '';
    }
    if(it.type === 'tone'){
      const b = this.scope.querySelector('.tone-pick'+q+' .tone-btn.selected');
      return b ? b.dataset.value : '';
    }
    const b = this.scope.querySelector('.opt-btn.selected'+q);
    return b ? b.dataset.letter : '';
  };
  KeyedQuiz.prototype.isCorrect = function(it, ans){
    const k = this.key[it.id];
    if(k == null || ans === '') return false;
    if(it.type === 'text'){
      return k.split('/').some(function(alt){ return normPinyin(alt, it.ignoreTones) === normPinyin(ans, it.ignoreTones); });
    }
    if(it.type === 'tone') return normPinyin(ans) === normPinyin(k);
    if(it.type === 'select') return k.split('/').some(function(alt){ return normPinyin(alt) === normPinyin(ans); });
    return String(ans).toUpperCase() === String(k).toUpperCase();
  };
  KeyedQuiz.prototype.updateLabel = function(){
    const o = this.opts;
    const keyed = this.keyedItems();
    const bar = o.scoreBarId ? document.getElementById(o.scoreBarId) : null;
    if(bar) bar.style.display = keyed.length ? '' : 'none';
    const note = o.noteId ? document.getElementById(o.noteId) : null;
    if(note){
      const missing = this.items.length - keyed.length;
      note.style.display = missing > 0 ? '' : 'none';
      note.innerHTML = missing > 0
        ? 'ℹ️ Hiện có đáp án cho <b>'+keyed.length+' / '+this.items.length+'</b> câu. Những câu chưa có đáp án gốc vẫn làm bình thường (để giáo viên xem khi nộp bài), chỉ không tự chấm.'
        : '';
    }
    if(this.graded) return;
    const txt = o.scoreTxtId ? document.getElementById(o.scoreTxtId) : null;
    if(txt){
      const self = this;
      const done = keyed.filter(it=>self.getAnswer(it) !== '').length;
      txt.textContent = 'Đã làm ' + done + ' / ' + keyed.length + ' câu có đáp án';
    }
  };
  KeyedQuiz.prototype.grade = function(){
    const self = this;
    this.graded = true;
    let correct = 0;
    const keyed = this.keyedItems();
    keyed.forEach(function(it){
      const ans = self.getAnswer(it);
      const ok = self.isCorrect(it, ans);
      if(ok) correct++;
      const q = '[data-q="'+it.id+'"]';
      if(it.type === 'text'){
        const inp = self.scope.querySelector('.key-input'+q);
        if(inp){ inp.disabled = true; inp.classList.add(ok ? 'correct' : 'wrong'); }
      } else if(it.type === 'select'){
        const sel = self.scope.querySelector('.key-select'+q);
        if(sel){ sel.disabled = true; sel.classList.add(ok ? 'correct' : 'wrong'); }
      } else if(it.type === 'tone'){
        self.scope.querySelectorAll('.tone-pick'+q+' .tone-btn').forEach(function(b){
          b.classList.add('locked');
          if(normPinyin(b.dataset.value) === normPinyin(self.key[it.id])) b.classList.add('correct');
          else if(b.classList.contains('selected')) b.classList.add('wrong');
        });
      } else {
        self.scope.querySelectorAll('.opt-btn'+q).forEach(function(b){
          b.classList.add('locked');
          if(String(b.dataset.letter).toUpperCase() === String(self.key[it.id]).toUpperCase()) b.classList.add('correct');
          else if(b.classList.contains('selected')) b.classList.add('wrong');
        });
      }
      const exp = self.scope.querySelector('.key-explain'+q);
      if(exp){
        const shown = it.label ? it.label(self.key[it.id]) : self.key[it.id];
        exp.innerHTML = ok ? '✓' : ('→ <b>'+escapeHtml(shown)+'</b>');
        exp.classList.toggle('ok', ok);
        exp.classList.add('show');
      }
    });
    const txt = this.opts.scoreTxtId ? document.getElementById(this.opts.scoreTxtId) : null;
    if(txt) txt.textContent = 'Kết quả: ' + correct + ' / ' + keyed.length + ' câu đúng 🎉';
    return correct;
  };
  KeyedQuiz.prototype.reset = function(){
    this.graded = false;
    this.scope.querySelectorAll('.key-input').forEach(function(inp){
      inp.disabled = false; inp.value = ''; inp.classList.remove('correct','wrong');
    });
    this.scope.querySelectorAll('.key-select').forEach(function(sel){
      sel.disabled = false; sel.value = ''; sel.classList.remove('correct','wrong');
    });
    this.scope.querySelectorAll('.tone-btn, .opt-btn').forEach(function(b){
      b.classList.remove('selected','correct','wrong','locked');
    });
    this.scope.querySelectorAll('.tone-pick').forEach(function(tp){
      const out = tp.querySelector('.tone-out'); if(out) out.textContent = tp.dataset.base;
    });
    this.scope.querySelectorAll('.key-explain').forEach(function(e){ e.classList.remove('show','ok'); e.innerHTML=''; });
    this.updateLabel();
  };
  KeyedQuiz.prototype.bind = function(){
    const self = this;
    const o = this.opts;
    // chọn 1 trong nhóm (tone + opt-btn), cập nhật số câu đã làm
    this.scope.addEventListener('click', function(e){
      if(self.graded) return;
      const tb = e.target.closest('.tone-btn');
      if(tb && self.scope.contains(tb)){
        const tp = tb.closest('.tone-pick');
        tp.querySelectorAll('.tone-btn').forEach(b=>b.classList.remove('selected'));
        tb.classList.add('selected');
        const out = tp.querySelector('.tone-out'); if(out) out.textContent = tb.dataset.value;
        self.updateLabel();
        return;
      }
      const ob = e.target.closest('.opt-btn');
      if(ob && self.scope.contains(ob) && !ob.classList.contains('locked')){
        const grp = ob.closest('.opt-group');
        if(grp) grp.querySelectorAll('.opt-btn').forEach(b=>b.classList.remove('selected'));
        ob.classList.add('selected');
        self.updateLabel();
      }
    });
    this.scope.addEventListener('input', function(e){
      if(e.target.classList && e.target.classList.contains('key-input')) self.updateLabel();
    });
    this.scope.addEventListener('change', function(e){
      if(e.target.classList && e.target.classList.contains('key-select')) self.updateLabel();
    });
    if(o.gradeBtnId){ const g = document.getElementById(o.gradeBtnId); if(g) g.addEventListener('click', ()=>self.grade()); }
    if(o.resetBtnId){ const r = document.getElementById(o.resetBtnId); if(r) r.addEventListener('click', ()=>self.reset()); }
    this.updateLabel();
  };
  KeyedQuiz.prototype.getSummary = function(){
    const self = this;
    const answers = {}, answerKey = {};
    let correct = this.graded ? 0 : null;
    this.items.forEach(function(it){
      const a = self.getAnswer(it);
      answers[it.id] = it.label ? (a ? it.label(a) : '') : a;
      if(self.key[it.id] != null){
        answerKey[it.id] = it.label ? it.label(self.key[it.id]) : self.key[it.id];
        if(self.graded && self.isCorrect(it, a)) correct++;
      }
    });
    return { total: this.keyedItems().length, graded: this.graded, correct: correct, answers: answers, answerKey: answerKey };
  };

  /* ---------- Gom đáp án của trang bài học để lưu/in kết quả. Gọi từ
     index.html qua frame.contentWindow.HSK.collectResult(meta).
     HSK1: mỗi bài tự khai báo danh sách phần chấm ở cuối <script>:
        window.HSK_PAGE.sections = [ {title:'…', quiz:<có getSummary()>}, … ]
     (giáo trình HSK1 mỗi bài có các phần khác nhau nên không cố định
     Nghe/Đọc/Viết như HSK2). Vẫn đọc được kiểu cũ (listening/reading/
     writingHanzi) nếu sau này có bài dùng. ---------- */
  function collectResult(meta){
    const page = window.HSK_PAGE || {};
    const result = {
      lessonId: meta && meta.lessonId,
      lessonName: meta && meta.lessonName,
      sections: []
    };
    (page.sections || []).forEach(function(sec){
      if(sec && sec.quiz && typeof sec.quiz.getSummary === 'function'){
        result.sections.push({ title: sec.title, short: sec.short || sec.title, summary: sec.quiz.getSummary() });
      }
    });
    [['listening','🎧 Nghe','Nghe'],['reading','📖 Đọc','Đọc'],['writingHanzi','✍️ Viết','Viết']].forEach(function(t){
      if(page[t[0]] && typeof page[t[0]].getSummary === 'function'){
        result.sections.push({ title:t[1], short:t[2], summary: page[t[0]].getSummary() });
      }
    });
    const sentences = [];
    document.querySelectorAll('.writing-textarea').forEach(function(ta){
      sentences.push({ q: ta.dataset.q, text: ta.value.trim(), sample: ta.dataset.sample || '' });
    });
    if(sentences.length) result.sentences = sentences;
    return result;
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* Dòng điểm ngắn cho bảng kết quả (ketqua.html): "Ngữ âm 6/7 · Nghe–Đọc 3/3" */
  function scoreLine(data){
    return (data.sections || []).map(function(s){
      const sum = s.summary || {};
      return escapeHtml(s.short) + ' ' + (sum.graded ? (sum.correct + '/' + sum.total) : '—');
    }).join(' · ') || '—';
  }

  function renderResultSummary(sum){
    if(!sum) return '<div class="pr-row">(chưa có dữ liệu)</div>';
    const head = sum.graded
      ? '<div class="pr-row"><b>Điểm: '+sum.correct+' / '+sum.total+'</b></div>'
      : '<div class="pr-row">(chưa chấm điểm)</div>';
    const rows = Object.keys(sum.answers).map(function(q){
      const chosen = sum.answers[q] || '';
      const correctAns = sum.answerKey ? sum.answerKey[q] : null;
      let line = 'Câu '+escapeHtml(q)+': <b>'+escapeHtml(chosen || '(chưa làm)')+'</b>';
      if(correctAns){
        const ok = normPinyin(chosen, false) === normPinyin(correctAns, false) ||
                   String(chosen).toUpperCase() === String(correctAns).toUpperCase();
        if(sum.graded){
          line += ok
            ? ' <span style="color:#2f9e56;">✓ đúng</span>'
            : ' <span style="color:#d13c2f;">✗ (đáp án: '+escapeHtml(correctAns)+')</span>';
        } else {
          line += ' <span style="color:#5c5148;">(đáp án: '+escapeHtml(correctAns)+')</span>';
        }
      }
      return '<div class="pr-row">'+line+'</div>';
    }).join('');
    return head + rows;
  }

  function buildPrintableHtml(data){
    const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleString('vi-VN') : '';
    const secHtml = (data.sections || []).map(function(s){
      return '<h2>'+escapeHtml(s.title)+'</h2>' + renderResultSummary(s.summary);
    }).join('') || '<div class="pr-row">(bài này chưa có phần chấm điểm)</div>';
    const sentHtml = (data.sentences && data.sentences.length)
      ? '<h2>✍️ Đặt câu</h2>' + data.sentences.map(function(s){
          let line = 'Câu '+escapeHtml(s.q)+': '+escapeHtml(s.text || '(chưa viết)');
          if(s.sample) line += '<br><span style="color:#5c5148;">Câu ví dụ tham khảo: '+escapeHtml(s.sample)+'</span>';
          return '<div class="pr-row">'+line+'</div>';
        }).join('')
      : '';
    return '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Kết quả — '+escapeHtml(data.hocvien)+'</title>' +
      '<style>' +
      'body{font-family:Arial,"Noto Sans SC",Helvetica,sans-serif;max-width:720px;margin:30px auto;color:#2a2118;}' +
      'h1{font-size:20px;margin-bottom:2px;}' +
      '.meta{color:#5c5148;font-size:13.5px;margin-bottom:20px;}' +
      'h2{font-size:16px;background:#fdf0ee;padding:8px 12px;border-radius:8px;margin-top:26px;}' +
      '.pr-row{padding:4px;border-bottom:1px solid #f3dcd6;font-size:14px;}' +
      '.pr-row:last-child{border-bottom:none;}' +
      '@media print{ body{margin:10px;} }' +
      '</style></head><body>' +
      '<h1>Kết quả luyện tập HSK1</h1>' +
      '<div class="meta">Học viên: <b>'+escapeHtml(data.hocvien)+'</b> &nbsp;·&nbsp; Bài: <b>'+escapeHtml(data.lessonName)+'</b> &nbsp;·&nbsp; Thời gian: '+timeStr+'</div>' +
      secHtml + sentHtml +
      '</body></html>';
  }

  /* ---------- Trò chơi Từ vựng "Đố vui tốc độ" — mỗi câu hiện 1 từ tiếng Trung
     (chữ Hán + pinyin), chọn đúng nghĩa tiếng Việt trong các lựa chọn trước khi
     hết giờ. Đúng liên tiếp được combo điểm thưởng, sai/hết giờ mất chuỗi. Điểm
     cao nhất lưu riêng theo từng bài trong localStorage để tạo động lực chơi lại.
     KHÔNG liên quan tới Nghe/Đọc/Viết — không tính vào "Nộp và in kết quả"/Sheet.
     vocabList: [{hanzi, pinyin, mean}, ...] — mean = nghĩa tiếng Việt. Danh sách
     rỗng hoặc dưới 4 từ → tự hiện thông báo "đang cập nhật", không lỗi.
     opts: {lessonId} dùng làm khoá lưu điểm cao nhất. ---------- */
  function mountVocabGame(containerSelector, vocabList, opts){
    const root = document.querySelector(containerSelector);
    if(!root) return;
    const lessonId = (opts && opts.lessonId) || 'bai';
    const HS_KEY = 'hsk1_vocab_highscore_' + lessonId;
    const TIME_MS = (opts && opts.timeMs) || 8000;
    const showPinyin = !!(opts && opts.showPinyin);

    const list = (vocabList || []).filter(function(w){ return w && w.hanzi && w.mean; });

    if(list.length < 4){
      root.innerHTML = '<div class="placeholder-box"><div class="big">📚</div>' +
        'Từ vựng bài này đang được cập nhật, quay lại sau nhé!</div>';
      return;
    }

    let order = [], qi = 0, score = 0, streak = 0, correctCount = 0, timer = null, tStart = 0, answered = false;

    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        const t=a[i]; a[i]=a[j]; a[j]=t;
      }
      return a;
    }

    function getHighScore(){ return parseInt(localStorage.getItem(HS_KEY) || '0', 10); }
    function setHighScore(v){ localStorage.setItem(HS_KEY, String(v)); }

    function renderStart(){
      const hs = getHighScore();
      root.innerHTML =
        '<div class="vocab-start">' +
          '<div class="vocab-start-icon">🎮</div>' +
          '<h3>Đố vui từ vựng tốc độ</h3>' +
          '<p>'+list.length+' từ · Trả lời đúng nghĩa trước khi hết giờ, đúng liên tiếp được combo điểm thưởng!</p>' +
          (hs > 0 ? '<div class="vocab-highscore">🏆 Điểm cao nhất: <b>'+hs+'</b></div>' : '') +
          '<button type="button" class="btn btn-primary vocab-start-btn">Bắt đầu chơi</button>' +
        '</div>';
      root.querySelector('.vocab-start-btn').addEventListener('click', startRound);
    }

    function startRound(){
      order = shuffle(list);
      qi = 0; score = 0; streak = 0; correctCount = 0;
      renderQuestion();
    }

    function makeOptions(correctWord){
      const pool = list.filter(function(w){ return w.hanzi !== correctWord.hanzi; });
      const distractors = shuffle(pool).slice(0, Math.min(3, pool.length)).map(function(w){ return w.mean; });
      return shuffle(distractors.concat([correctWord.mean]));
    }

    function renderQuestion(){
      answered = false;
      if(qi >= order.length){ renderEnd(); return; }
      const word = order[qi];
      const options = makeOptions(word);
      root.innerHTML =
        '<div class="vocab-game">' +
          '<div class="vocab-hud">' +
            '<span class="vocab-progress">Câu '+(qi+1)+' / '+order.length+'</span>' +
            '<span class="vocab-score">Điểm: '+score+'</span>' +
            (streak >= 2 ? '<span class="vocab-streak">🔥 Combo x'+streak+'</span>' : '') +
          '</div>' +
          '<div class="vocab-timerbar"><div class="vocab-timerbar-fill"></div></div>' +
          '<div class="vocab-word">' +
            '<div class="vocab-hanzi">'+word.hanzi+'</div>' +
            (showPinyin && word.pinyin ? '<div class="vocab-pinyin">'+word.pinyin+'</div>' : '') +
          '</div>' +
          '<div class="vocab-options">' +
            options.map(function(opt){ return '<button type="button" class="vocab-opt-btn">'+opt+'</button>'; }).join('') +
          '</div>' +
        '</div>';

      const fill = root.querySelector('.vocab-timerbar-fill');
      tStart = Date.now();
      clearInterval(timer);
      timer = setInterval(function(){
        const elapsed = Date.now() - tStart;
        const pct = Math.max(0, 100 - (elapsed / TIME_MS) * 100);
        if(fill) fill.style.width = pct + '%';
        if(elapsed >= TIME_MS){
          clearInterval(timer);
          if(!answered) handleAnswer(null, word);
        }
      }, 50);

      root.querySelectorAll('.vocab-opt-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          if(answered) return;
          handleAnswer(btn, word);
        });
      });
    }

    function handleAnswer(btnEl, word){
      answered = true;
      clearInterval(timer);
      const isCorrect = !!btnEl && btnEl.textContent === word.mean;
      root.querySelectorAll('.vocab-opt-btn').forEach(function(b){
        b.classList.add('locked');
        if(b.textContent === word.mean) b.classList.add('correct');
        else if(b === btnEl) b.classList.add('wrong');
      });
      if(isCorrect){
        streak++;
        correctCount++;
        const bonus = Math.min(streak, 5) * 2;
        score += 10 + (streak > 1 ? bonus : 0);
      } else {
        streak = 0;
      }
      const scoreEl = root.querySelector('.vocab-score');
      if(scoreEl) scoreEl.textContent = 'Điểm: ' + score;
      setTimeout(function(){ qi++; renderQuestion(); }, 900);
    }

    function renderEnd(){
      const hs = getHighScore();
      const isNewHigh = score > hs;
      if(isNewHigh) setHighScore(score);
      root.innerHTML =
        '<div class="vocab-end">' +
          '<div class="vocab-end-icon">'+(isNewHigh ? '🏆' : '🎉')+'</div>' +
          '<h3>'+(isNewHigh ? 'Kỷ lục mới!' : 'Hoàn thành!')+'</h3>' +
          '<div class="vocab-end-score">'+score+' điểm</div>' +
          '<p>Đúng '+correctCount+' / '+order.length+' câu' + (isNewHigh ? '' : ' · Điểm cao nhất: '+hs) + '</p>' +
          '<button type="button" class="btn btn-primary vocab-again-btn">Chơi lại</button>' +
        '</div>';
      root.querySelector('.vocab-again-btn').addEventListener('click', startRound);
    }

    renderStart();
  }

  return { el, initTabs, Quiz, KeyedQuiz, mountSentenceWriting, imgFallback, bindSingleSelect, parseAnswerKey, parseKeyFile, mountListeningQuiz, mountVocabGame, collectResult, escapeHtml, scoreLine, buildPrintableHtml, speak, addTone, normPinyin };
})();