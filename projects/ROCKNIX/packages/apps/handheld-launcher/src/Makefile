CC ?= gcc
CFLAGS ?= -O2 -Wall
CFLAGS += $(shell pkg-config --cflags sdl2 2>/dev/null || sdl2-config --cflags 2>/dev/null || echo "-I/usr/include/SDL2 -D_REENTRANT")
LIBS += $(shell pkg-config --libs sdl2 2>/dev/null || sdl2-config --libs 2>/dev/null || echo "-lSDL2") -lm

TARGET = handheld-launcher

all: $(TARGET)

$(TARGET): main.c
	$(CC) $(CFLAGS) -o $@ $^ $(LIBS)

install: $(TARGET)
	install -d $(DESTDIR)/usr/bin
	install -m 755 $(TARGET) $(DESTDIR)/usr/bin/

clean:
	rm -f $(TARGET)
