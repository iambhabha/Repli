/**
 * Repli → Google Sheets.
 *
 * A standalone Apps Script project. It opens the sheet by id, so it does not
 * have to be created from inside the spreadsheet:
 *
 *   script.google.com → New project → paste this → Save
 *   Deploy → New deployment → Web app
 *     Execute as:  Me
 *     Who has access:  Anyone
 *   Copy the /exec URL it gives you.
 *
 * "Anyone" sounds alarming and is not, as long as SECRET below is changed:
 * the URL is unguessable and every request has to carry the secret, so the
 * only thing on the internet that can write here is the bot that knows it.
 * Nothing in this script reads or returns any data - it only appends and
 * updates rows - so a request without the secret learns nothing either.
 *
 * Then, on the bot:
 *
 *   node scripts/set-sheet-webhook.js <the /exec URL> <the same secret>
 */

/** Change this. Anything long and random; it just has to match the bot. */
var SECRET = 'CHANGE-ME';

/**
 * The spreadsheet this writes into, by id.
 *
 * openById rather than getActiveSpreadsheet, so this can live as its own
 * project instead of being bound to the sheet. Bound scripts have to be
 * created from inside the sheet, through a menu that Google would not open
 * for the right account on a browser with nine of them signed in.
 */
var SHEET_ID = '1vn-Sap1wIF818pXNPRx8T6xFJg_9o49SUEKCB6VvM0M';

var CUSTOMERS = 'Customers';
var ORDERS = 'Orders';

/** Column K on the Customers tab. Named, because two functions write it. */
var LAST_MESSAGE_COL = 11;

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (!body || body.secret !== SECRET) {
      return reply({ ok: false, error: 'no' });
    }

    if (body.kind === 'customer') return reply(upsertCustomer(body.row));
    if (body.kind === 'order') return reply(appendOrder(body.row));
    if (body.kind === 'seen') return reply(touchCustomer(body.row));
    return reply({ ok: false, error: 'unknown kind' });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function sheetNamed(name) {
  var book = SpreadsheetApp.openById(SHEET_ID);
  return book.getSheetByName(name) || book.insertSheet(name);
}

/**
 * An ISO timestamp, as a date the sheet understands.
 *
 * The bot sends times as ISO strings, and a string lands in the cell as a
 * string: left-aligned, unsortable, and shown as 2026-08-22T08:28:25.367Z
 * instead of a time anyone wants to read. Converting here means the owner
 * gets a real date, in the spreadsheet's own timezone, which they can sort
 * and filter like any other.
 *
 * Anything unparseable falls back to now rather than poisoning the cell -
 * the timestamp is a convenience, and a bad one must not cost a write.
 */
function asDate(value) {
  if (!value) return new Date();
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Phone numbers are text, not arithmetic.
 *
 * Left to itself the sheet reads 919829374438 as a number - it drops leading
 * zeros, and long numbers turn into 9.19829E+11 the moment a column is
 * narrow. Nobody adds up phone numbers, so the cell is forced to plain text
 * BEFORE the value goes in: setting the format afterwards is too late, the
 * number has already been parsed and the original digits are gone.
 */
function writeRow(sheet, at, values, phoneColumn) {
  sheet.getRange(at, phoneColumn).setNumberFormat('@');
  sheet.getRange(at, 1, 1, values.length).setValues([values]);
}

/**
 * Two phone numbers, compared the way a person would.
 *
 * A number that reached the sheet before this was fixed is sitting in the
 * cell as a number, and String(9198...) is not the same string as the one
 * the bot sends when either end carries a plus, a space or a leading zero.
 * Comparing digits only means an old row is still found and updated instead
 * of being duplicated - which is what a mismatch here actually costs.
 */
function sameNumber(a, b) {
  var left = String(a === null || a === undefined ? '' : a).replace(/\D/g, '');
  var right = String(b === null || b === undefined ? '' : b).replace(/\D/g, '');
  if (!left || !right) return false;
  if (left === right) return true;
  // 9829374438 and 919829374438 are one person with and without the country
  // code, which is how the same customer arrives from two different places.
  return left.slice(-10) === right.slice(-10);
}

/**
 * One row per person, found by phone number.
 *
 * A customer who orders three times should be one row that stays current,
 * not three rows with three versions of the same address. The phone number
 * is the only thing about them that never changes.
 */
function upsertCustomer(row) {
  var sheet = sheetNamed(CUSTOMERS);
  var phones = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();

  var at = 0;
  for (var i = 1; i < phones.length; i++) {
    if (sameNumber(phones[i][0], row.phone)) {
      at = i + 1;
      break;
    }
  }

  var values = [
    String(row.phone),
    row.name,
    row.address,
    row.city,
    row.state,
    row.pincode,
  ];

  if (at) {
    // Only the six fields this knows about. Columns G onwards hold the
    // totals and the dates, which are written separately.
    writeRow(sheet, at, values, 1);
    if (row.last_message_at) {
      sheet.getRange(at, LAST_MESSAGE_COL).setValue(asDate(row.last_message_at));
    }
    return { ok: true, updated: at };
  }

  var next = sheet.getLastRow() + 1;
  writeRow(sheet, next, values.concat(['', '', '', new Date(), asDate(row.last_message_at)]), 1);
  return { ok: true, added: next };
}

/**
 * Just the time, on a row that already exists.
 *
 * Somebody who messages, browses and leaves is not a customer yet and gets
 * no row - a sheet full of people who said "hi" once is a sheet nobody
 * reads. But once they have ordered, when they last spoke is worth knowing,
 * and this keeps that current without rewriting anything else about them.
 */
function touchCustomer(row) {
  var sheet = sheetNamed(CUSTOMERS);
  var phones = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();

  for (var i = 1; i < phones.length; i++) {
    if (sameNumber(phones[i][0], row.phone)) {
      sheet.getRange(i + 1, LAST_MESSAGE_COL).setValue(asDate(row.last_message_at));
      return { ok: true, touched: i + 1 };
    }
  }
  return { ok: true, touched: 0 };
}

/** Orders are events. They are appended and never rewritten. */
function appendOrder(row) {
  var sheet = sheetNamed(ORDERS);
  var at = sheet.getLastRow() + 1;
  writeRow(
    sheet,
    at,
    [
      row.order_id,
      asDate(row.created_at),
      String(row.phone),
      row.name,
      row.items,
      row.quantity,
      row.total,
      row.booking_amount,
      row.remaining_amount,
      row.status,
      row.payment_status,
      row.payment_mode,
      row.address,
      row.city,
      row.state,
      row.pincode,
    ],
    3
  );
  return { ok: true, added: at };
}
