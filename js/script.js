"use strict";

/**
  エリア(ごみ処理の地域）を管理するクラスです。
*/
var AreaModel = function() {
  this.mastercode;
  this.label;
  this.centerName;
  this.center;
  this.trash = new Array();
  /**
  各ゴミのカテゴリに対して、最も直近の日付を計算します。
*/
  this.calcMostRect = function() {
    for (var i = 0; i < this.trash.length; i++) {
      this.trash[i].calcMostRect(this);
    }
  }
  /**
    休止期間（主に年末年始）かどうかを判定します。
  */
  this.isBlankDay = function(currentDate) {
    // センターデータが未定義の場合は安全のためfalseを返す
    if (!this.center || !this.center.startDate || !this.center.endDate) {
        return false;
    }
    
    var period = [this.center.startDate, this.center.endDate];

    if (period[0].getTime() <= currentDate.getTime() &&
      currentDate.getTime() <= period[1].getTime()) {
      return true;
    }
    return false;
  }
  /**
    ゴミ処理センターを登録します。
    名前が一致するかどうかで判定を行っております。
  */
  this.setCenter = function(center_data) {
    for (var i in center_data) {
      if (this.centerName == center_data[i].name) {
        this.center = center_data[i];
      }
    }
  }
  /**
  ゴミのカテゴリのソートを行います。
*/
  this.sortTrash = function() {
    this.trash.sort(function(a, b) {
      if (a.mostRecent === undefined || a.mostRecent === null) { return 1; }
      if (b.mostRecent === undefined || b.mostRecent === null) { return -1; }
      var at = a.mostRecent.getTime();
      var bt = b.mostRecent.getTime();
      if (at < bt) return -1;
      if (at > bt) return 1;
      return 0;
    });
  }
}

/**
  各ゴミのカテゴリを管理するクラスです。
*/
var TrashModel = function(_lable, _cell, remarks) {
  this.remarks = remarks;
  this.dayLabel;
  this.mostRecent;
  this.dayList;
  this.mflag = new Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

  // CSVセルの解析
  if (_cell.search(/:/) >= 0) {
    var flag = _cell.split(":");
    this.dayCell = flag[0].split(" ");
    var mm = flag[1].split(" ");
  } else {
    this.dayCell = _cell.split(" ");
    var mm = new Array("4", "5", "6", "7", "8", "9", "10", "11", "12", "1", "2", "3");
  }
  for (var m in mm) {
    this.mflag[mm[m] - 1] = 1;
  }

  this.label = _lable;
  this.description;
  this.regularFlg = 1;      // 定期回収フラグ（デフォルトはオン:1）
  this.sagaFlg = 0;         // 年末調整データの有無

  var result_text = "";
  var today = new Date();

  var isRegularPatternFound = false;
  var isDatePatternFound = false;

  for (var j in this.dayCell) {
    var cell = this.dayCell[j];

    if (!cell) continue; 

    if (cell.length == 1) { // 毎週〇曜日 (例: "月")
      result_text += "毎週" + cell + "曜日 ";
      isRegularPatternFound = true;
    } else if (cell.length == 2 && cell.substr(0,1) != "*") { // 第n〇曜日 (例: "金1")
      result_text += "第" + cell.charAt(1) + cell.charAt(0) + "曜日 ";
      isRegularPatternFound = true;
    } else if (cell.match(/^\d{8}$/)) { // YYYYMMDD形式の日付 (例: "20251230")
      isDatePatternFound = true;
      this.sagaFlg = 1;
      
      var adjustmentDate = new Date(cell.substring(0,4) + '-' + cell.substring(4,6) + '-' + cell.substring(6,8));
      if (today <= adjustmentDate) {
        // 現在日より後の日付の場合のみ表示テキストに追加
        // YYYYMMDDが複数ある場合、複数回「年末調整日」と表示される可能性あり
        result_text += "年末調整日"; 
      }
    } else if (cell.length == 2 && cell.substr(0,1) == "*") { 
      // 例: "*1" (備考フラグ)
      // dayLabelには影響しない
    } else {
      // その他の拡張文字列
    }
  }
  
  // 定期パターンが見つからず、日付パターンのみが見つかった場合、不定期回収と見なす
  if (!isRegularPatternFound && isDatePatternFound) {
      result_text = "不定期 ";
      this.regularFlg = 0; 
  }

  this.dayLabel = result_text;
  this.description;

  this.getDateLabel = function() {
    var result_text = ( this.mostRecent === undefined || this.mostRecent === null )
      ? ''
      : " " + this.mostRecent.getFullYear() + "/" + (1 + this.mostRecent.getMonth()) + "/" + this.mostRecent.getDate();
    return this.getRemark() + this.dayLabel + result_text;
  }

  var day_enum = ["日", "月", "火", "水", "木", "金", "土"];

  function getDayIndex(str) {
    for (var i = 0; i < day_enum.length; i++) {
      if (day_enum[i] == str) {
        return i;
      }
    };
    return -1;
  }
  /**
   * このごみ収集日が特殊な条件を持っている場合備考を返します。収集日データに"*n" が入っている場合に利用されます
   */
  this.getRemark = function getRemark() {
    var ret = "";
    this.dayCell.forEach(function(day){
      if (day && day.substr(0,1) == "*") {
        remarks.forEach(function(remark){
          if (remark.id == day.substr(1,1)){
            ret += remark.text + "<br/>";
          }
        });
      };
    });
    return ret;
  }
  
  /**
  このゴミの年間のゴミの日を計算します。
  センターが休止期間がある場合は、その期間１週間ずらすという実装を行っております。
*/
  this.calcMostRect = function(areaObj) {
    var day_mix = this.dayCell;
    var day_list = new Array();

    // 定期回収の場合
    if (this.regularFlg == 1) {

      var today = new Date();

      // 12月 +3月　を表現
      for (var i = 0; i < MaxMonth; i++) {

        var curMonth = today.getMonth() + i;
        var curYear = today.getFullYear() + Math.floor(curMonth / 12);
        var month = (curMonth % 12) + 1;

        // 収集が無い月はスキップ
        if (this.mflag[month - 1] == 0) {
            continue;
        }
        for (var j in day_mix) {
          //休止期間だったら、今後一週間ずらす。
          var isShift = false;
          //remarkだったらスキップする。
          if (day_mix[j] && day_mix[j].charAt(0) === "*") {
            continue;
          }
          
          // YYYYMMDD形式の特例日はここでは処理しない (定期パターンのみを計算)
          if (day_mix[j] && day_mix[j].match(/^\d{8}$/)) { 
            continue; 
          }
