import { createSignal } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN } from "@pocketjs/framework/input";

mount(() => {
  const [lastButton, setLastButton] = createSignal("Press a direction or face button");
  const [presses, setPresses] = createSignal(0);
  const pressed = (button: string) => {
    setLastButton(button);
    setPresses((count) => count + 1);
  };
  return (
    <View class="w-full h-full bg-slate-950 p-8 flex-col gap-4">
      <Text class="text-2xl font-bold text-white">ROCKNIX</Text>
      <Text class="text-xl text-emerald-300">PocketJS / Direct KMS</Text>
      <Text class="text-lg text-slate-300">RG34XX - 720 x 480</Text>
      <Text class="text-xl text-white">{lastButton()}</Text>
      <Text class="text-lg text-slate-300">Input events: {presses()}</Text>
      <Text class="text-base text-slate-400">Native apps from SSH: pocket-session-run COMMAND</Text>
      <ActionHandler button={BTN.UP} onPress={() => pressed("Up")} />
      <ActionHandler button={BTN.DOWN} onPress={() => pressed("Down")} />
      <ActionHandler button={BTN.LEFT} onPress={() => pressed("Left")} />
      <ActionHandler button={BTN.RIGHT} onPress={() => pressed("Right")} />
      <ActionHandler button={BTN.CROSS} onPress={() => pressed("Cross")} />
      <ActionHandler button={BTN.CIRCLE} onPress={() => pressed("Circle")} />
      <ActionHandler button={BTN.SQUARE} onPress={() => pressed("Square")} />
      <ActionHandler button={BTN.TRIANGLE} onPress={() => pressed("Triangle")} />
      <ActionHandler button={BTN.START} onPress={() => pressed("Start")} />
    </View>
  );
});
