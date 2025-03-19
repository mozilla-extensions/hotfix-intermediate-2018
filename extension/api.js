/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "skeleton" }]*/
/* global ExtensionAPI */

const PREF_HOTFIX_DONE = "extensions.hotfix-intermediate-2018.done";
const PREF_MASTER_PASSWORD_REQUEST = "extensions.hotfix-intermediate-2018.requestMasterPassword";

this.hotfixIntermediateCert = class extends ExtensionAPI {
  onStartup() {
    if (Services.prefs.getBoolPref(PREF_HOTFIX_DONE, false)) {
      // Return earlier if the hotfix has been already applied.
      return;
    }
    this.applyHotFix();
  }

  async applyHotFix() {
    let XPIDatabase;

    try {
      XPIDatabase = ChromeUtils.importESModule("resource://gre/modules/addons/XPIDatabase.sys.mjs").XPIDatabase;
    } catch (err) {
      console.warn("Unable to load XPIDatabase.sys.mjs", err);
      return;
    }

    if (!XPIDatabase.verifySignatures) {
      // If this is Firefox <63, verifySignatures was an XPIProvider method, but we are not targeting
      // Firefox versions as old as that anyway.
      console.warn("XPIDatabase.verifySignatures not found (Firefox version is likely too old)");
      return;
    }

    // First, check if there's a master password on the token DB. If so,
    // the user will need to login before we can add a certificate.
    try {
      let tokendb = Cc["@mozilla.org/security/pk11tokendb;1"].getService(Ci.nsIPK11TokenDB);
      let token = tokendb.getInternalKeyToken();

      if (!token.checkPassword("")) {
        // Calling `token.login(true)` here would trigger a dialog that would be requesting
        // the user to fill in their Master Password, that would be surprising and so we
        // bail only do that if the user has set a pref to explicitly allow that (e.g. in
        // case we may want to allow users to manually install the extension and manually
        // insert their Master Password to get past this corner case).
        if (!Services.prefs.getBoolPref(PREF_MASTER_PASSWORD_REQUEST, false)) {
          console.warn(
            `CertDB is locked by a MasterPassword, set ${PREF_MASTER_PASSWORD_REQUEST} to true` +
            " in about:config to allow the hotfix to request the Master Password and insert the correct certificate."
          );
        } else {
          token.login(true);
        }
      }
    } catch (e) {
      console.error("failed to login pkcs#11 token:", e); // eslint-disable-line no-console
    }

    // Second, inject the new cert.
    try {
      let intermediate = `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`;
      let certDB = Cc["@mozilla.org/security/x509certdb;1"].getService(Ci.nsIX509CertDB);
      // The last argument is a name which was actually ignored so later removed:
      // https://dxr.mozilla.org/mozilla-esr52/rev/5350524b/security/manager/ssl/nsIX509CertDB.idl#418
      certDB.addCertFromBase64(intermediate, ",,", "");
      console.log("new intermediate certificate added"); // eslint-disable-line no-console
    } catch (e) {
      // If this fails, do not move on to the re-verify step.
      return;
    }

    // Finally, force a re-verify of signatures.
    try {
      await XPIDatabase.verifySignatures();
      Services.prefs.setBoolPref(PREF_HOTFIX_DONE, true);
      console.log("signatures re-verified"); // eslint-disable-line no-console
    } catch (e) {
      console.error("failed to re-verify signatures:", e); // eslint-disable-line no-console
    }
  }
};
