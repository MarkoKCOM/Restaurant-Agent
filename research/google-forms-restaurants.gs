// שאלון גילוי צרכים — מסעדות ועסקי מזון
// How to use:
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Paste this entire script
// 4. Click Run → createRestaurantsForm
// 5. Authorize when prompted
// 6. The form URL will appear in the execution log

function createRestaurantsForm() {
  var form = FormApp.create('שאלון גילוי צרכים — מסעדות ועסקי מזון');
  form.setDescription('מטרה: להבין אילו משימות יומיומיות גוזלות הכי הרבה זמן ואיפה אוטומציה חכמה יכולה לעזור.\nזמן מילוי: 5 דקות');

  // Q1
  var q1 = form.addMultipleChoiceItem();
  q1.setTitle('1. מה סוג העסק שלך?')
    .setChoices([
      q1.createChoice('מסעדה עם הושבה'),
      q1.createChoice('בית קפה'),
      q1.createChoice('משלוחים / דארק קיצ\'ן'),
      q1.createChoice('קייטרינג / אירועים')
    ])
    .setRequired(true)
    .showOtherOption(true);

  // Q2
  var q2 = form.addMultipleChoiceItem();
  q2.setTitle('2. כמה עובדים יש בעסק?')
    .setChoices([
      q2.createChoice('עד 5'),
      q2.createChoice('6-15'),
      q2.createChoice('16-30'),
      q2.createChoice('30+')
    ])
    .setRequired(true);

  // Q3
  var q3 = form.addCheckboxItem();
  q3.setTitle('3. מה 3 המשימות שגוזלות לך הכי הרבה זמן ביום? (בחר עד 3)')
    .setChoices([
      q3.createChoice('ניהול הזמנות טלפוניות / וואטסאפ'),
      q3.createChoice('תיאום משמרות וניהול עובדים'),
      q3.createChoice('הזמנת סחורה מספקים'),
      q3.createChoice('מענה ללקוחות (שאלות, תלונות, שינויים)'),
      q3.createChoice('ניהול רשתות חברתיות (פוסטים, סטוריז)'),
      q3.createChoice('הנהלת חשבונות וחשבוניות'),
      q3.createChoice('מעקב מלאי'),
      q3.createChoice('ניהול הזמנות לאירועים / שולחנות')
    ])
    .setRequired(true)
    .showOtherOption(true);

  // Q4
  var q4 = form.addCheckboxItem();
  q4.setTitle('4. איך לקוחות מזמינים אצלך היום?')
    .setChoices([
      q4.createChoice('טלפון'),
      q4.createChoice('וואטסאפ'),
      q4.createChoice('אפליקציית משלוחים (וולט, תן ביס וכו\')'),
      q4.createChoice('אתר אינטרנט'),
      q4.createChoice('מגיעים פיזית')
    ])
    .setRequired(true)
    .showOtherOption(true);

  // Q5
  var q5 = form.addMultipleChoiceItem();
  q5.setTitle('5. כמה זמן ביום אתה או מישהו מהצוות מבלה בטלפון / וואטסאפ עם לקוחות?')
    .setChoices([
      q5.createChoice('פחות משעה'),
      q5.createChoice('1-3 שעות'),
      q5.createChoice('3-5 שעות'),
      q5.createChoice('כמעט כל היום')
    ])
    .setRequired(true);

  // Q6
  var q6 = form.addMultipleChoiceItem();
  q6.setTitle('6. מה קורה כשאתה עסוק מדי לענות ללקוח?')
    .setChoices([
      q6.createChoice('הוא הולך למתחרה'),
      q6.createChoice('אני חוזר אליו מאוחר יותר'),
      q6.createChoice('יש מישהו אחר שעונה')
    ])
    .setRequired(true)
    .showOtherOption(true);

  // Q7
  var q7 = form.addCheckboxItem();
  q7.setTitle('7. אילו כלים דיגיטליים אתה משתמש בהם?')
    .setChoices([
      q7.createChoice('וואטסאפ בלבד'),
      q7.createChoice('מערכת קופה / POS'),
      q7.createChoice('אקסל / גוגל שיטס'),
      q7.createChoice('תוכנה לניהול מסעדה'),
      q7.createChoice('תוכנת הזמנות (Tabit, Ontopo וכו\')')
    ])
    .setRequired(true)
    .showOtherOption(true);

  // Q8
  var q8 = form.addMultipleChoiceItem();
  q8.setTitle('8. כמה אתה משלם היום על שירותים חיצוניים (רואה חשבון, ניהול סושיאל, קול סנטר)?')
    .setChoices([
      q8.createChoice('לא משלם — עושה הכל לבד'),
      q8.createChoice('עד 2,000 ₪ בחודש'),
      q8.createChoice('2,000-5,000 ₪ בחודש'),
      q8.createChoice('5,000-10,000 ₪ בחודש'),
      q8.createChoice('10,000+ ₪ בחודש')
    ])
    .setRequired(true);

  // Q9
  form.addParagraphTextItem()
    .setTitle('9. אם היה לך "עובד דיגיטלי" שעובד 24/7, מה הדבר הראשון שהיית נותן לו לעשות?')
    .setRequired(true);

  // Q10
  var q10 = form.addMultipleChoiceItem();
  q10.setTitle('10. כמה היית מוכן לשלם בחודש על כלי שחוסך לך 2-3 שעות ביום?')
    .setChoices([
      q10.createChoice('עד 300 ₪'),
      q10.createChoice('300-700 ₪'),
      q10.createChoice('700-1,500 ₪'),
      q10.createChoice('1,500-3,000 ₪'),
      q10.createChoice('מעל 3,000 ₪ (אם זה באמת עובד)')
    ])
    .setRequired(true);

  // Q11
  form.addParagraphTextItem()
    .setTitle('11. מה הדבר שהכי מתסכל אותך בניהול היומיומי?')
    .setRequired(true);

  form.setConfirmationMessage('תודה! התשובות שלך יעזרו לנו לבנות כלי שבאמת פותר בעיות אמיתיות.');

  Logger.log('Form created: ' + form.getEditUrl());
  Logger.log('Share this link: ' + form.getPublishedUrl());
}
