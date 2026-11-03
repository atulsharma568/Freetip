"use client";

import { ExtraPicker } from "@/components/tip/ExtraPicker";
import { FieldNote } from "@/components/tip/FieldNote";
import { StepHeading } from "@/components/tip/StepHeading";
import { useTipForm } from "@/components/tip/TipFormContext";
import { Switch } from "@/components/ui/Switch";

// Step 2: name, message, the pin offer and the extras (picks, soundboard, voice). The message
// limit, the anonymous option and what the extras need all come from the form, not the document.
export function NoteBlock() {
  const {
    anonymous,
    setAnonymous,
    tipName,
    changeName,
    remember,
    changeRemember,
    message,
    setMessage,
    messageMaxChars,
    messageLimit,
    moreChars,
    messageTooLong,
    rulePicked,
    pinOffer,
    pin,
    setPin,
    pinTooPricey,
    pinNeedsMessage,
    sounds,
    rules,
    voiceMinPaise,
    extra,
    chooseExtra,
    chosenSound,
    soundTooPricey,
    voiceTooPricey,
    amountPaise,
    displayName,
  } = useTipForm();
  const nearLimit = message.length >= messageLimit - 20;

  return (
    <div className="space-y-4">
      <StepHeading n={2} title="Your note" />
      <div className="flex items-center gap-3">
        <Switch id="anon-toggle" checked={anonymous} onChange={setAnonymous} />
        <label htmlFor="anon-toggle" className="cursor-pointer select-none text-sm text-text">
          Tip anonymously
        </label>
      </div>
      <div className="space-y-2">
        <label htmlFor="tip-name" className="text-sm text-muted">
          Your name <span className="text-control">(optional)</span>
        </label>
        <input
          id="tip-name"
          type="text"
          maxLength={50}
          value={tipName}
          onChange={(e) => changeName(e.target.value)}
          placeholder={anonymous ? "Hidden" : "Riya, Kabir…"}
          disabled={anonymous}
          autoComplete="off"
          className="h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text transition-[border-color,opacity] duration-200 placeholder:text-muted focus:border-accent disabled:opacity-40"
        />
        {!anonymous && (
          <div className="flex items-center gap-3 pt-1">
            <Switch id="remember-name" checked={remember} onChange={changeRemember} />
            <label htmlFor="remember-name" className="cursor-pointer select-none text-sm text-muted">
              Remember my name on this device
            </label>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="tip-message" className="text-sm text-muted">
          Message <span className="text-control">(optional)</span>
        </label>
        <textarea
          id="tip-message"
          maxLength={messageMaxChars}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={rulePicked ? "Not needed with a streamer's pick" : "Great stream today!"}
          disabled={rulePicked}
          className="w-full resize-none rounded-[var(--radius-field)] border border-control bg-ground px-4 py-3 text-base text-text transition-[border-color,opacity] placeholder:text-muted focus:border-accent disabled:opacity-40"
        />
        {rulePicked && (
          <FieldNote>
            A streamer&apos;s pick plays its GIF and sound on its own, so there is no message. Choose another amount or
            tap the pick again to write one.
          </FieldNote>
        )}
        <p aria-live={nearLimit ? "polite" : "off"} className="text-right text-xs text-muted">
          {message.length}/{messageLimit}
          {moreChars && ` · tip ₹${moreChars.rupees} or more for ${moreChars.limit}`}
        </p>
        {messageTooLong && (
          <FieldNote>
            Your message is {message.length - messageLimit} characters too long for this tip.
            {moreChars
              ? ` Shorten it, or tip ₹${moreChars.rupees} or more for ${moreChars.limit} characters.`
              : " Please shorten it."}
          </FieldNote>
        )}
      </div>
      {pinOffer && !rulePicked && (
        <div className="space-y-2 rounded-[var(--radius-field)] border border-line/60 p-4">
          <div className="flex items-center gap-3">
            <Switch id="pin-toggle" checked={pin} onChange={setPin} />
            <label htmlFor="pin-toggle" className="cursor-pointer select-none text-sm text-text">
              Pin my message on stream for {pinOffer.seconds} seconds
            </label>
          </div>
          <p className="text-xs text-muted">
            For tips of ₹{Math.ceil(pinOffer.minPaise / 100)} or more, and there is no extra fee. {displayName} approves it
            first and can take it down at any time. Tips are final, so if it is not pinned or is taken down, the
            tip is not refunded.
          </p>
        </div>
      )}
      {pinTooPricey && pinOffer && (
        <FieldNote>
          Tip at least ₹{Math.ceil(pinOffer.minPaise / 100)} to pin your message, or untick the pin.
        </FieldNote>
      )}
      {pinNeedsMessage && <FieldNote>Write a message to pin, or untick the pin.</FieldNote>}
      {(sounds.length > 0 || rules.length > 0 || voiceMinPaise !== null) && (
        <ExtraPicker
          sounds={sounds}
          rules={rules}
          voiceMinPaise={voiceMinPaise}
          hasMessage={!!message.trim()}
          selected={extra}
          amountPaise={amountPaise}
          onSelect={chooseExtra}
        />
      )}
      {soundTooPricey && chosenSound && (
        <FieldNote>
          Tip at least ₹{Math.ceil(chosenSound.minPaise / 100)} to play {chosenSound.name}, or pick another
          sound.
        </FieldNote>
      )}
      {voiceTooPricey && voiceMinPaise !== null && (
        <FieldNote>
          Tip at least ₹{Math.ceil(voiceMinPaise / 100)} to have your message read aloud, or pick something
          else.
        </FieldNote>
      )}
    </div>
  );
}
