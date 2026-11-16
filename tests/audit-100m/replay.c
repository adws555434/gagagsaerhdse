#include <stdint.h>
#include <inttypes.h>
#include <stdio.h>
#include <math.h>

#define LIMIT 128
#define TRIALS UINT32_C(100000000)

static inline double uniform(uint32_t *state) {
    *state = *state * UINT32_C(1664525) + UINT32_C(1013904223);
    return (double)*state * 0x1p-32;
}

static inline unsigned poisson(double stop, uint32_t *state) {
    double product = uniform(state);
    unsigned goals = 0;
    while (product > stop) {
        product *= uniform(state);
        ++goals;
    }
    return goals;
}

int main(void) {
    unsigned id;
    double home_rate, away_rate, home_stop, away_stop;
    while (scanf("%u %lf %lf %lf %lf", &id, &home_rate, &away_rate, &home_stop, &away_stop) == 5) {
        uint32_t counts[LIMIT][LIMIT] = {{0}};
        uint32_t first[LIMIT][LIMIT] = {{0}};
        uint32_t outcomes[3] = {0};
        uint32_t state = 260127;
        for (uint32_t i = 0; i < TRIALS; ++i) {
            const unsigned home = poisson(home_stop, &state);
            const unsigned away = poisson(away_stop, &state);
            if (home >= LIMIT || away >= LIMIT) return 2;
            ++outcomes[home > away ? 0 : home == away ? 1 : 2];
            if (!counts[home][away]++) first[home][away] = i;
        }
        unsigned best_home = 0, best_away = 0;
        for (unsigned home = 0; home < LIMIT; ++home) for (unsigned away = 0; away < LIMIT; ++away) {
            const uint32_t n = counts[home][away], best = counts[best_home][best_away];
            if (n > best || (n == best && first[home][away] < first[best_home][best_away])) {
                best_home = home;
                best_away = away;
            }
        }
        printf("%u %" PRIu32 " %" PRIu32 " %" PRIu32 " %u %u %" PRIu32 "\n",
            id, outcomes[0], outcomes[1], outcomes[2], best_home, best_away, counts[best_home][best_away]);
        fflush(stdout);
    }
    return ferror(stdin) ? 3 : 0;
}
