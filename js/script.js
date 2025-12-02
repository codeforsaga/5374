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
        result_text += "年末調整日"; 
      }
    } else if (cell.length == 2 && cell.substr(0,1) == "*") { 
      // 例: "*1" (備考フラグ)
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
          
          //week=0が第1週目です。
          for (var week = 0; week < 5; week++) {
            //4月1日を起点として第n曜日などを計算する。
            var date = new Date(curYear, month - 1, 1);
            var d = new Date(date);
            //コンストラクタでやろうとするとうまく行かなかった。。
            //
            //4月1日を基準にして曜日の差分で時間を戻し、最大５週までの増加させて毎週を表現
            d.setTime(date.getTime() + 1000 * 60 * 60 * 24 *
              ((7 + getDayIndex(day_mix[j].charAt(0)) - date.getDay()) % 7) + week * 7 * 24 * 60 * 60 * 1000
            );
            //年末年始のずらしの対応
            //休止期間なら、今後の日程を１週間ずらす
            if (areaObj.isBlankDay(d)) {
              if (WeekShift) {
                isShift = true;
              } else {
                continue;
              }
            }
            if (isShift) {
              d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
            //同じ月の時のみ処理したい
            if (d.getMonth() != (month - 1) % 12) {
              continue;
            }
            //特定の週のみ処理する
            if (day_mix[j].length > 1) {
              if (week != day_mix[j].charAt(1) - 1) {
                continue;
              }
            }
            day_list.push(d);
          }
        }
      }
    } 
    
    // YYYYMMDD形式の例外日処理を if/else の外側に独立させる
    if (Array.isArray(day_mix)) {
      day_mix.forEach((v, i) => {
        // YYYYMMDD形式にマッチした場合のみ処理
        if (!v || !v.match(/^\d{8}$/)) { return; } 
        
        var year = parseInt(day_mix[i].substr(0, 4));
        var month = parseInt(day_mix[i].substr(4, 2)) - 1;
        var day = parseInt(day_mix[i].substr(6, 2));
        var d = new Date(year, month, day);
        
        day_list.push(d);
      });
    }

    //曜日によっては日付順ではないので最終的にソートする。
    day_list.sort(function(a, b) {
      var at = a.getTime();
      var bt = b.getTime();
      if (at < bt) return -1;
      if (at > bt) return 1;
      return 0;
    })
    //直近の日付を更新
    var now = new Date();

    for (var i in day_list) {
      if (
        ( this.mostRecent === undefined || this.mostRecent === null )
        && now.getTime() < day_list[i].getTime() + 24 * 60 * 60 * 1000
      ) {
        this.mostRecent = day_list[i];
        break;
      }
    };

    this.dayList = day_list;
  }
  /**
   計算したゴミの日一覧をリスト形式として取得します。
  */
  this.getDayList = function() {
    var day_text = "<ul>";
    for (var i in this.dayList) {
      var d = this.dayList[i];
      day_text += "<li>" + d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + "</li>";
    };
    day_text += "</ul>";
    return day_text;
  }
}
/**
センターのデータを管理します。
*/
var CenterModel = function(row) {
  function getDay(center, index) {
    if (!center[index]) {
        console.error("center.csvの日付データが不正です: row index " + index);
        // 不正な場合は安全な日付を返す
        return new Date(0); 
    }
    var tmp = center[index].split("/");
    return new Date(tmp[0], tmp[1] - 1, tmp[2]);
  }

  this.name = row[0];
  this.startDate = getDay(row, 1);
  this.endDate = getDay(row, 2);
}
/**
* ゴミのカテゴリを管理するクラスです。
* description.csvのモデルです。
*/
var DescriptionModel = function(data) {
  this.targets = new Array();

  this.label = data[0];
  this.sublabel =
