import React from 'react';
import StatisticBox, { STATISTIC_ORDER } from 'interface/others/StatisticBox';
import SPELLS from 'common/SPELLS';
import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import { formatPercentage } from 'common/format';
import RACES from 'game/RACES';
import Analyzer from 'parser/core/Analyzer';
import Abilities from 'parser/core/modules/Abilities';

const BUFF_WINDOW_TIME = 60;

/**
 * The Night Elf racial ability Shadowmeld can be used by as a DPS cooldown for Feral druids.
 * The stealth provided by Shadowmeld doubles the damage of a Rake cast while it's active.
 * This analyzer checks how often Shadowmeld is being to buff Rake's damage.
 */
class Shadowmeld extends Analyzer {
  static dependencies = {
    abilities: Abilities,
  };

  wastedDuringStealth = 0;
  correctUses = 0;
  totalUses = 0;

  constructor(...args) {
    super(...args);
    this.active = this.selectedCombatant.race === RACES.NightElf;
  }

  on_byPlayer_cast(event) {
    if (event.ability.guid === SPELLS.RAKE.id &&
      this.selectedCombatant.hasBuff(SPELLS.SHADOWMELD.id, null, BUFF_WINDOW_TIME)) {
      // using Rake when Shadowmeld is active means Shadowmeld was used correctly
      this.correctUses += 1;
      return;
    }

    if (event.ability.guid !== SPELLS.SHADOWMELD.id) {
      return;
    }
    this.totalUses += 1;

    if (this.selectedCombatant.hasBuff(SPELLS.INCARNATION_KING_OF_THE_JUNGLE_TALENT.id) ||
        this.selectedCombatant.hasBuff(SPELLS.PROWL.id, null, BUFF_WINDOW_TIME) ||
        this.selectedCombatant.hasBuff(SPELLS.PROWL_INCARNATION.id, null, BUFF_WINDOW_TIME)) {
      // using Shadowmeld when the player already has a stealth (or stealth-like) effect active is almost always a mistake
      this.wastedDuringStealth += 1;
    }
  }

  get possibleUses() {
    const cooldown = this.abilities.getAbility(SPELLS.SHADOWMELD.id).cooldown * 1000;
    return Math.floor(this.owner.fightDuration / cooldown) + 1;
  }

  get efficiencyThresholds() {
    return {
      actual: this.correctUses / this.possibleUses,
      isLessThan: {
        minor: 0.90,
        average: 0.80,
        major: 0.70,
      },
      style: 'percentage',
    };
  }

  get wastedDuringStealthThresholds() {
    return {
      actual: this.wastedDuringStealth / this.totalUses,
      isGreaterThan: {
        minor: 0.0,
        average: 0.10,
        major: 0.20,
      },
      style: 'percentage',
    };
  }

  statistic() {
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.SHADOWMELD.id} />}
        value={`${formatPercentage(this.correctUses / this.possibleUses)}%`}
        label="Shadowmeld used to buff Rake"
        tooltip={`You used Shadowmeld <b>${this.correctUses}</b> times to increase Rake's damage.<br />
          <li>You could have used it <b>${this.possibleUses}</b> times.
          <li>You used it <b>${this.totalUses}</b> times (<b>${this.totalUses - this.correctUses}</b> didn't buff Rake.)
          <li>You used Shadowmeld while already benefiting from a stealth effect <b>${this.wastedDuringStealth}</b> times.`}
        position={STATISTIC_ORDER.OPTIONAL()}
      />
    );
  }

  suggestions(when) {
    when(this.efficiencyThresholds).addSuggestion((suggest, actual, recommended) => {
      return suggest(
        <React.Fragment>
          You could be using <SpellLink id={SPELLS.SHADOWMELD.id} /> to increase your <SpellLink id={SPELLS.RAKE.id} /> damage more often. Activating <SpellLink id={SPELLS.SHADOWMELD.id} /> and immediately using <SpellLink id={SPELLS.RAKE.id} /> will cause it to deal double damage.
        </React.Fragment>
      )
        .icon(SPELLS.SHADOWMELD.icon)
        .actual(`${(actual * 100).toFixed(0)}% cast efficiency.`)
        .recommended(`>${(recommended * 100).toFixed(0)}% is recommended`);
    });

    when(this.wastedDuringStealthThresholds).addSuggestion((suggest, actual, recommended) => {
      return suggest(
        <React.Fragment>
          You are wasting <SpellLink id={SPELLS.SHADOWMELD.id} /> by using it when you already have a stealth effect active.
        </React.Fragment>
      )
        .icon(SPELLS.SHADOWMELD.icon)
        .actual(`${this.wastedDuringStealth} cast${this.wastedDuringStealth === 1 ? '' : 's'} when already stealthed.`)
        .recommended('0 is recommended');
    });
  }
}

export default Shadowmeld;
