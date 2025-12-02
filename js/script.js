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

  // 佐賀県内の年末調整データの有無
  this.sagaFlg = 0;

  var result_text = "";
  var today = new Date();

  for (var j in this.dayCell) {
    if (this.dayCell[j].length == 1) {
      result_text += "毎週" + this.dayCell[j] + "曜日 ";
    } else if (this.dayCell[j].length == 2 && this.dayCell[j].substr(0,1) != "*") {
      result_text += "第" + this.dayCell[j].charAt(1) + this.dayCell[j].charAt(0) + "曜日 ";
    } else if (this.dayCell[j].length == 2 && this.dayCell[j].substr(0,1) == "*") {
    } else {
      // YYYYMMDD形式の文字列が来る可能性のある場所
      if (this.dayCell[j].match(/^\d{8}$/)) {
        // YYYYMMDD形式の場合
        if (this.dayCell.length > 1) { 
          // 定期パターンと混在している場合（例外日）
          var adjustmentDate = new Date(this.dayCell[j].substring(0,4) + '-' + this.dayCell[j].substring(4,6) + '-' + this.dayCell[j].substring(6,8));
          if (today <= adjustmentDate) {
            result_text += "年末調整日"
          }
          this.sagaFlg = 1; // フラグは設定されるが、計算ロジックは独立させる
        } else {
          // YYYYMMDD形式のみの場合（不定期回収）
          result_text = "不定期 ";
          this.regularFlg = 0;  // 定期回収フラグオフ
        }
      } else {
        // その他の拡張文字列の場合（ここでは処理をスキップまたは既存処理維持）
        // 元のコードではここに到達しないはずですが、念のため
      }
    }
  }
  this.dayLabel = result_text;

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
      if (day.substr(0,1) == "*") {
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
          if (day_mix[j].charAt(0) === "*") {
            continue;
          }
          
          // 💡 修正 1: YYYYMMDD形式の特例日はここでは処理しない (定期パターンのみを計算)
          if (day_mix[j].match(/^\d{8}$/)) { 
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
    /* 元のコードにあった else { ... } ブロックは削除しました。
     不定期回収（YYYYMMDD指定）の処理は、以下の独立したブロックに統合されます。
     これにより、定期・不定期を問わず、YYYYMMDD形式の日付が正しく処理されます。
    */
    
    // 💡 修正 2: YYYYMMDD形式の例外日処理を if/else の外側に独立させる
    if (Array.isArray(day_mix)) {
      day_mix.forEach((v, i) => {
        // YYYYMMDD形式にマッチした場合のみ処理
        if (!v.match(/^\d{8}$/)) { return; }
        
        var year = parseInt(day_mix[i].substr(0, 4));
        var month = parseInt(day_mix[i].substr(4, 2)) - 1;
        var day = parseInt(day_mix[i].substr(6, 2));
        var d = new Date(year, month, day);
        
        day_list.push(d);
      });
    }

    //曜日によっては日付順ではないので最終的にソートする。
    //ソートしなくてもなんとなりそうな気もしますが、とりあえずソート
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
  this.sublabel = data[1];//not used
  this.description = data[2];//not used
  this.styles = data[3];
  this.background = data[4];

}
/**
 * ゴミのカテゴリの中のゴミの具体的なリストを管理するクラスです。
 * target.csvのモデルです。
 */
var TargetRowModel = function(data) {
  this.type = data[0];
  this.name = data[1];
  this.notice = data[2];
  this.furigana = data[3];
}

/**
 * ゴミ収集日に関する備考を管理するクラスです。
 * remarks.csvのモデルです。
 */
var RemarkModel = function(arg) {
  this.id = arg[0];
  this.text = arg[1];
}

/**
  エリアマスターを管理するクラスです。
  area_master.csvのモデルです。
*/
var AreaMasterModel = function() {
  this.mastercode;
  this.name;
}


/* var windowHeight; */

$(function() {
/* windowHeight = $(window).height(); */

  var center_data = new Array();
  var descriptions = new Array();
  var areaModels = new Array();
  var remarks = new Array();
  var areaMasterModels  = new Array();
/* var descriptions = new Array(); */


  // ローカルストレージ（エリア名）
  function getSelectedAreaName() {
    return localStorage.getItem("selected_area_name");
  }

  function setSelectedAreaName(name) {
    localStorage.setItem("selected_area_name", name);
  }

  // ローカルストレージ（エリアマスター名）
  function getSelectedAreaMasterName() {
    return localStorage.getItem("selected_area_master_name");
  }

  function setSelectedAreaMasterName(name) {
    localStorage.setItem("selected_area_master_name", name);
  }

  // ローカルストレージ（エリアマスター名）
  function getSelectedAreaMasterNameBefore() {
    return localStorage.getItem("selected_area_master_name_before");
  }

  function setSelectedAreaMasterNameBefore(name) {
    localStorage.setItem("selected_area_master_name_before", name);
  }

  function csvToArray(filename, cb) {
    $.get(filename, function(csvdata) {
      //CSVのパース作業
      //CRの解析ミスがあった箇所を修正しました。
      //以前のコードだとCRが残ったままになります。
      // var csvdata = csvdata.replace("\r/gm", ""),
       csvdata = csvdata.replace(/\r/gm, "");
      var line = csvdata.split("\n"),
          ret = [];
      for (var i in line) {
        //空行はスルーする。
        if (line[i].length == 0) continue;

        var row = line[i].split(",");
        ret.push(row);
      }
      cb(ret);
    });
  }


  function masterAreaList() {
    // ★エリアのマスターリストを読み込みます
    // 大阪府仕様。大阪府下の区一覧です
    csvToArray("data/area_master.csv", function(tmp) {
      var area_master_label = tmp.shift();    // ラベル
      for (var i in tmp) {
        var row           = tmp[i];
        var area_master   = new AreaMasterModel();
        area_master.mastercode    = row[0];
        area_master.name  = row[1];
        areaMasterModels.push(area_master);
      }

      // ListメニューのHTMLを作成
      var selected_master_name = getSelectedAreaMasterName();
      var area_master_select_form = $("#select_area_master");
      var select_master_html = "";
      select_master_html += '<option value="-1">地域を選択してください</option>';
      for (var row_index in areaMasterModels) {
        var area_master_name = areaMasterModels[row_index].name;
        var selected = (selected_master_name == area_master_name) ? 'selected="selected"' : "";

        select_master_html += '<option value="' + row_index + '" ' + selected + " >" + area_master_name + "</option>";
      }

      //デバッグ用
      if (typeof dump == "function") {
        dump(areaMasterModels);
      }
      //HTMLへの適応
      area_master_select_form.html(select_master_html);
      area_master_select_form.change();
    });
  }


  function updateAreaList(mastercode) {
    // 大阪府仕様。区のコード(mastercode)が引数です
    csvToArray("data/area_days.csv", function(tmp) {
      var area_days_label = tmp.shift();
      for (var i in tmp) {
        var row = tmp[i];
        var area = new AreaModel();
        area.mastercode = row[0];
        area.label = row[1];
        area.centerName = row[2];

        // 区コードが一致した場合のみデータ格納
        if(area.mastercode == mastercode){
          areaModels.push(area);
          //２列目以降の処理
          for (var r = 3; r < 3 + MaxDescription; r++) {
            if (area_days_label[r]) {
              var trash = new TrashModel(area_days_label[r], row[r], remarks);
              area.trash.push(trash);
            }
          }
        }
      }

      csvToArray("data/center.csv", function(tmp) {
        //ゴミ処理センターのデータを解析します。
        //表示上は現れませんが、
        //金沢などの各処理センターの休止期間分は一週間ずらすという法則性のため
        //例えば第一金曜日のときは、一周ずらしその月だけ第二金曜日にする
        tmp.shift();
        for (var i in tmp) {
          var row = tmp[i];

          var center = new CenterModel(row);
          center_data.push(center);
        }
        //ゴミ処理センターを対応する各地域に割り当てます。
        for (var i in areaModels) {
          var area = areaModels[i];
          area.setCenter(center_data);
        };
        //エリアとゴミ処理センターを対応後に、表示のリストを生成する。
        //ListメニューのHTML作成
        var selected_name = getSelectedAreaName();
        var area_select_form = $("#select_area");
        var select_html = "";
        select_html += '<option value="-1">地域を選択してください</option>';
        for (var row_index in areaModels) {
          var area_name = areaModels[row_index].label;
          var selected = (selected_name == area_name) ? 'selected="selected"' : "";

          select_html += '<option value="' + row_index + '" ' + selected + " >" + area_name + "</option>";
        }

        //
